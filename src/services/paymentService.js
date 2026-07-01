const Plan = require("../modals/planModal");
const Transaction = require("../modals/transactionModal");
const User = require("../modals/userModal");
const Subscription = require('../modals/subscriberModal')
const UserToken = require('../modals/userTokanWithExpired');
const { sequelize } = require("../../dbConfig");
const { Op } = require("sequelize");
const Order = require("../modals/orderModal");
const Cart = require("../modals/cartModal");
const { createOrder } = require("../utils/bambiniService");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const validateSessionId = async (sessionId) => {
    try {
        const isExitSessionId = await Transaction.findOne({
            where: {
                stripe_session_id: sessionId
            }, transaction: t
        })
        return isExitSessionId ? true : false
    } catch (error) {
        return error
    }
}

const createStripeCustomer = async (user_id, name, email) => {
    try {
        console.log("user_id, name, email", user_id, name, email)
        const customer = await stripe.customers.create({
            name: name,
            email: email,
            metadata: {
                user_id: user_id
            }
        });
        if (customer) {
            return customer.id;
        }
    } catch (error) {
        throw new error("Helper error at createStripeCustomer: " + error.message);
    }
}

const createCheckoutSession = async (req, res, next) => {
    try {
        const { plan_id } = req.body;
        const id = req.user.user_id

        console.log("plan_id ", plan_id, " ", " id ", id)
        console.log("plan_id ", plan_id, " ", " id ", req.user)
        const subbscriptionPlan = await Plan.findOne({
            where: {
                id: plan_id
            }
        });
        console.log("subbscriptionPlan", subbscriptionPlan)

        if (!subbscriptionPlan || !subbscriptionPlan.stripe_price_id) {
            throw new CoustomError('User not found', 400)
            // return sendResponse(res, 'Invalid subscription plan', 400)
        }

        // Get user data
        const customer = await User.findOne({
            where: {
                id
            }
        });
        console.log("customer", customer)
        let stripe_customer_id = null;
        if (!customer || customer.length <= 0) {
            throw new CoustomError('User not found', 404)
            // sendResponse(res, 'User not found', 404)
        }

        if (customer.stripe_customer_id) {
            stripe_customer_id = customer.stripe_customer_id;
        } else {
            stripe_customer_id = await createStripeCustomer(customer.id, customer.name, customer.email);

            if (!stripe_customer_id) {
                throw new CoustomError('Stripe customer id not found', 400)
                // return 
                // respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Stripe customer id not found");
            }

            await User.update(
                { stripe_customer_id },
                {
                    where: {
                        id,
                    },
                }
            );
            // const updated = await updateUserCustomerDB(user_id, stripe_customer_id);
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: stripe_customer_id, // Link session to a specific Stripe customer
            payment_method_types: ['card'],
            line_items: [
                {
                    price: subbscriptionPlan.stripe_price_id,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });

        return sendResponse(res, "Checkout session created successfully", 200, { checkoutUrl: session.url })
        //  respond(res, true, HTTP_STATUS_CODE.OK, "Checkout session created successfully", {
        //     checkoutUrl: session.url
        // });

    } catch (err) {
        next(err)
        // return respond(
        //     res,
        //     false,
        //     HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
        //     "Stripe session creation failed: " + (err.message || "Unknown error")
        // );
    }
};

const getInvoiceLinks = async (invoiceId) => {
    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        return {
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf
        };
    } catch (err) {
        throw err;
    }
};

const calculateEndDate = (subscription) => {
    try {
        const start_date = new Date(subscription.start_date * 1000);
        let end_date = new Date(start_date); // Clone start_date

        const count = subscription.plan.interval_count;
        const interval = subscription.plan.interval;

        switch (interval) {
            case 'day':
                end_date.setDate(end_date.getDate() + count);
                break;
            case 'week':
                end_date.setDate(end_date.getDate() + (count * 7));
                break;
            case 'month':
                end_date.setMonth(end_date.getMonth() + count);
                break;
            case 'year':
                end_date.setFullYear(end_date.getFullYear() + count);
                break;
            default:
                throw new Error(`Unsupported interval type: ${interval}`);
        }

        return { start_date, end_date };

    } catch (err) {
        throw err;
    }
}

async function handleCheckoutSessionCompleted(session) {
    // console.log("session", session)
    const t = await sequelize.transaction();
    console.log("Hello")
    if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const invoiceData = await stripe.invoices.retrieve(subscription.latest_invoice);
        const stripe_invoice_id = invoiceData.id;
        const customerId = session.customer;
        const priceId = subscription.items.data[0].price.id;
        const totalAmount = session.amount_total / 100;

        const user = await User.findOne({
            where: {
                stripe_customer_id: customerId
            }, transaction: t
        });
        if (!user) {
            return;
        }
        const plan = await Plan.findOne({
            where: {
                stripe_price_id: priceId
            }, transaction: t
        });

        if (!plan) {
            return;
        }
        // console.log("user", user)
        if (user.stripe_subscription_id) {
            try {
                await stripe.subscriptions.cancel(user.stripe_subscription_id);
                const getSubscription = await Subscription.findOne({
                    where: {
                        stripe_subscription_id: user.stripe_subscription_id,
                        user_id: user.id,
                        status: 'active'
                    }
                }, { transaction: t });
                if (getSubscription) {
                    await getSubscription.update({
                        status: 'inactive',
                        payment_status: "paid",
                    }, { transaction: t })
                }
                console.log("Old subscription cancelled:", user.stripe_subscription_id);
            } catch (err) {
                console.error("Error cancelling old subscription:", err.message);
            }
        }

        let newSubscription;
        const invoiceLinks = await getInvoiceLinks(stripe_invoice_id);
        const { start_date, end_date } = calculateEndDate(subscription);
        try {
            newSubscription = await Subscription.create({
                plan_id: plan.id,
                user_id: user.id,
                transaction_id: stripe_invoice_id,
                payment_method: 'stripe',
                stripe_invoice_url: invoiceLinks.hosted_invoice_url,
                stripe_invoice_pdf: invoiceLinks.invoice_pdf,
                start_date,
                end_date,
                status: subscription.status,
                stripe_subscription_id: subscription.id,
            }, { transaction: t });

            console.log("subscription.id,", subscription.id)
            await user.update({
                active_plan_id: plan ? plan.id : null,
                current_subscription_id: newSubscription.id,
                stripe_subscription_id: subscription.id,
            }, { transaction: t });

            await UserToken.create({
                user_id: user.id,
                total_scan_token: plan.token_count,
                remaining_scan_token: plan.token_count,
                used_scan_token: 0,
                type: 'plan',
                expired_at: end_date
            }, { transaction: t });

        } catch (error) {
            console.log("error", error)
        }
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        const TransactionThrough = await Transaction.findOne({
            where: {
                payment_method_id: subscription.default_payment_method
            }, transaction: t
        })
        let tran;
        if (TransactionThrough) {
            if (TransactionThrough.subscription_id !== null) {
                tran = await TransactionThrough.update({
                    stripe_session_id: session.id,
                    stripe_invoice_id,
                    stripe_invoice_url: invoiceLinks.hosted_invoice_url,
                    stripe_invoice_pdf: invoiceLinks.invoice_pdf,
                    status: 'paid',
                    paid_at: new Date(invoice.status_transitions.paid_at * 1000),
                    transaction_id: session.subscription,
                    user_id: user.id,
                    type: 'subscription',
                }, { transaction: t });
            } else {
                tran = await TransactionThrough.update({
                    stripe_session_id: session.id,
                    subscription_id: newSubscription.id,
                    stripe_invoice_id,
                    stripe_invoice_url: invoiceLinks.hosted_invoice_url,
                    stripe_invoice_pdf: invoiceLinks.invoice_pdf,
                    status: 'paid',
                    paid_at: new Date(invoice.status_transitions.paid_at * 1000),
                    transaction_id: session.subscription,
                    user_id: user.id,
                    type: 'subscription',
                }, { transaction: t })
            }
        } else {
            tran = await Transaction.create({
                stripe_session_id: session.id,
                subscription_id: newSubscription.id,
                stripe_invoice_id,
                stripe_invoice_url: invoiceLinks.hosted_invoice_url,
                stripe_invoice_pdf: invoiceLinks.invoice_pdf,
                status: 'paid',
                paid_at: new Date(invoice.status_transitions.paid_at * 1000),
                payment_method_id: subscription.default_payment_method,
                transaction_id: session.subscription,
                user_id: user.id,
                type: 'subscription',
            }, { transaction: t });
        }
        await newSubscription.update({
            inner_transaction_id: tran.id,
            payment_status: 'paid'
        }, { transaction: t })
        await t.commit();
    }
    else if (session.mode === 'payment') {
        try {
            let sessionId = session.id
            const customerId = session.customer;
            const totalAmount = session.amount_total / 100;
            console.log("session for order", session)
            let metadata = session.metadata
            const userId = metadata.user_id

            const orderId = session.metadata.order_id;
            let cartIds = null;
            let isReorder = metadata.is_reorder == "true";

            if (isReorder) {
                const oldOrderId = metadata.order_id;
                console.log("Processing Reorder for Order ID:", oldOrderId);
                cartIds = [];
            } else {
                try {
                    cartIds = metadata.cart_id ? JSON.parse(metadata.cart_id) : [];
                } catch (e) {
                    cartIds = [];
                }
            }

            const order = await Order.findByPk(orderId);
            console.log("order", order)
            if (!order) throw new CoustomError("Order not found", 404);
            let invoiceData;
            try {
                invoiceData = await getInvoiceLinks(session.invoice);
            } catch (error) {
                console.log("error for order", error)
            }

            console.log("invoiceData", invoiceData)
            const invoiceUrl = invoiceData.hosted_invoice_url
            const invoicePdf = invoiceData.invoice_pdf
            const invoiceId =
                session.invoice ||
                (typeof session.invoice === "string" ? session.invoice : null);

            const invoice = await stripe.invoices.retrieve(session.invoice)
            console.log("session.invoice", invoice)

            if (session.payment_status == "paid") {
                await order.update({
                    order_status: "Placed",
                    payment_method: session.payment_method_types[0],
                });

                const isAddedTran = await Transaction.findOne({
                    where: {
                        stripe_payment_intent_id: session.payment_intent
                    }
                })

                if (isAddedTran) {
                    await isAddedTran.update({
                        user_id: userId,
                        order_id: order.id,
                        stripe_session_id: session.id,
                        transaction_id: session.payment_intent,
                        amount: totalAmount,
                        status: session.payment_status,
                        stripe_invoice_id: invoiceId,
                        stripe_invoice_pdf: invoicePdf,
                        stripe_invoice_url: invoiceUrl,
                        // payment_method: session.payment_method_types[0],
                        paid_at: new Date(invoice.status_transitions.paid_at * 1000),
                        type: "order",
                    })
                } else {
                    await Transaction.create({
                        user_id: userId,
                        order_id: order.id,
                        stripe_session_id: session.id,
                        stripe_payment_intent_id: session.payment_intent,
                        transaction_id: session.payment_intent,
                        amount: totalAmount,
                        status: session.payment_status,
                        stripe_invoice_id: invoiceId,
                        stripe_invoice_pdf: invoicePdf,
                        stripe_invoice_url: invoiceUrl,
                        payment_method: session.payment_method_types[0],
                        paid_at: new Date(invoice.status_transitions.paid_at * 1000),
                        type: "order",
                    });
                }
                const userData = await User.findByPk(userId);
                if (userData) await userData.increment("orders", { by: 1 });

                if (!isReorder && cartIds.length > 0) {
                    await Cart.destroy({ where: { id: cartIds, user_id: userId } });
                }

                try {
                    const bambiniResponse = await createOrder(orderId, userData);
                    if (bambiniResponse.status) {
                        await order.update({
                            retailer_order_id: bambiniResponse.order_id,
                            retailer_status: "Success",
                        });
                        console.log("Bambini Order Placed:", bambiniResponse.order_id);
                    } else {
                        await order.update({
                            retailer_status: "Failed",
                            retailer_error_log: JSON.stringify(
                                bambiniResponse.errors || bambiniResponse.message,
                            ),
                        });
                        console.error(
                            "Bambini Rejected Order but Payment is Done:",
                            bambiniResponse.errors,
                        );
                    }
                } catch (bambiniErr) {
                    await order.update({
                        retailer_status: "Failed",
                        retailer_error_log: bambiniErr.message,
                    });
                    console.error("Bambini API Error:", bambiniErr);
                }
            } else {
                await order.update({ order_status: "Failed" });
                await Transaction.create({
                    user_id: userId,
                    order_id: order.id,
                    stripe_session_id: sessionId,
                    payment_intent_id: session.payment_intent,
                    transaction_id: session.payment_intent,
                    amount: session.amount_total / 100,
                    // status: session.payment_status,
                    status: "failed",
                    invoice_url: null,
                    invoice_id: invoiceId,
                    payment_method: session.payment_method_types[0] || "n/a",
                });

                return res.status(200).json({
                    success: false,
                    message:
                        "Payment was not successful. Your order has been marked as failed.",
                    orderId: order.order_id,
                });
            }


        } catch (error) {
            console.log("here is the error", error)
        }


































        // const customerId = session.customer;
        // // const totalAmount = session.amount_total / 100;
        // console.log("session for order", session)
        // // Database se User dhundein
        // // const user = await User.findOne({ where: { stripe_customer_id: customerId }, transaction: t });

        // await Transaction.create({
        //     user_id: user ? user.id : null,
        //     stripe_payment_intent_id: session.payment_intent,
        //     total_amount: totalAmount,
        //     status: 'paid',
        //     payment_method: 'stripe',
        //     type: 'order',
        //     paid_at: new Date()
        // }, { transaction: t });
        // console.log("Order payment successful for:", session.payment_intent);
        // await t.commit();
    }
}

async function handleChargeSucceeded(charge) {
    try {
        // console.log("payment before", charge)
        let payment;
        const TransactionData = await Transaction.findOne({
            where: {
                payment_method_id: charge.payment_method
            }
        })
        if (TransactionData) {
            payment = await TransactionData.update({
                stripe_charge_id: charge.id,
                stripe_payment_intent_id: charge.payment_intent,
                total_amount: charge.amount / 100,
                payment_method: "stripe",
                status: "paid",
                paid_at: new Date(charge.created * 1000),
            })
        }
        else {
            payment = await Transaction.create({
                stripe_charge_id: charge.id,
                stripe_payment_intent_id: charge.payment_intent,
                total_amount: charge.amount / 100,
                payment_method: "stripe",
                status: "paid",
                payment_method_id: charge.payment_method,
                paid_at: new Date(charge.created * 1000),
            });
        }
    } catch (err) {
        console.log("Hello err", err)
        res.status(500).send('Webhook processing failed.');
    }
}

async function handleInvoicePaid(invoice) {
    // // console.log("invoice", invoice)
    // if (!invoice.subscription) return;
    // await Subscription.update(
    //     {
    //         status: "active",
    //         end_date: new Date(invoice.lines.data[0].period.end * 1000),
    //     },
    //     {
    //         where: {
    //             transaction_id: invoice.id,
    //         },
    //     }
    // );


    if (!invoice.subscription) return;

    const t = await sequelize.transaction();
    try {
        const subscription = await Subscription.findOne({
            where: { stripe_subscription_id: invoice.subscription },
            transaction: t
        });
        if (!subscription) return;

        await Transaction.create({
            user_id: subscription.user_id,
            subscription_id: subscription.id,
            stripe_invoice_id: invoice.id,
            stripe_invoice_url: invoice.hosted_invoice_url,
            stripe_invoice_pdf: invoice.invoice_pdf,
            status: 'paid',
            paid_at: new Date(invoice.status_transitions.paid_at * 1000),
            total_amount: invoice.amount_paid / 100,
            type: 'subscription',
            payment_method: 'stripe'
        }, { transaction: t });

        const plan = await Plan.findOne({ where: { id: subscription.plan_id }, transaction: t });
        await UserToken.create({
            user_id: subscription.user_id,
            total_scan_token: plan.token_count,
            remaining_scan_token: plan.token_count,
            used_scan_token: 0,
            type: 'plan',
            expired_at: new Date(invoice.lines.data[0].period.end * 1000)
        }, { transaction: t });

        await subscription.update({
            status: 'active',
            end_date: new Date(invoice.lines.data[0].period.end * 1000)
        }, { transaction: t });

        await t.commit();
    } catch (err) {
        await t.rollback();
        console.error("Renewal Transaction Error:", err);
    }
}

async function handleInvoicePaymentFailed(invoice) {

    const subscription = await Subscription.findOne({
        where: {
            transaction_id: invoice.id,
        }
    })

    // const subscription = await getSubscriptionByStripeIdDB(invoice.subscription);
    if (!subscription) return;

    // Update subscription status
    // await updateSubscriptionStatusDB(subscription.id, 'pending');

    // Create failed transaction record
    await subscription.update({
        status: 'pending',
    })
}

async function handleSubscriptionCreated(subscription) {
    try {
        await Subscription.update(
            { payment_status: subscription.status },
            {
                where: {
                    stripe_subscription_id: subscription.id,
                },
            }
        );
    } catch (err) {
        throw err;
    }
}

async function handleSubscriptionUpdated(subscription) {
    const updateData = {
        payment_status: subscription.status,
        end_date: new Date(subscription.current_period_end * 1000),
        updated_at: new Date(),
    };

    if (subscription.cancel_at_period_end) {
        updateData.cancelled_at = new Date();
    }

    await Subscription.update(updateData, {
        where: { stripe_subscription_id: subscription.id },
    });
}

async function handleSubscriptionDeleted(subscription) {
    await Subscription.update(
        {
            payment_status: "canceled",
            cancelled_at: new Date(),
        },
        {
            where: { stripe_subscription_id: subscription.id },
        }
    );
}

async function handlePaymentIntentFailed(paymentIntent) {
    // PaymentIntent mein metadata se order_id nikal sakte hain
    const orderId = paymentIntent.metadata.order_id;

    await Transaction.update(
        { status: 'failed' },
        { where: { stripe_payment_intent_id: paymentIntent.id } }
    );
    console.log(`Payment failed for Order: ${orderId}`);
}

async function handleCheckoutSessionExpired(session) {
    await Transaction.update(
        { status: 'expired' },
        { where: { stripe_session_id: session.id } }
    );
}

module.exports = {
    createStripeCustomer,
    getInvoiceLinks,
    handleCheckoutSessionCompleted,
    handleChargeSucceeded,
    handleInvoicePaid,
    handleInvoicePaymentFailed,
    handleSubscriptionCreated,
    handleSubscriptionUpdated,
    handleSubscriptionDeleted,
    handlePaymentIntentFailed,
    handleCheckoutSessionExpired
}
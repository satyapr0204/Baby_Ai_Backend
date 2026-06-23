const BabyProfile = require('../modals/babyProfileModal');
const Color = require('../modals/ProductModal/color');
const { shuffleArray, safeJsonParse } = require('./sharedHelpers');


// const sortProductsByBabyPreference = async (products, babyId) => {
//     if (!products || products.length === 0) return [];

//     let processedProducts = shuffleArray(products);
//     if (!babyId) return processedProducts;

//     try {
//         const babyInstance = await BabyProfile.findOne({
//             where: { id: babyId },
//             attributes: ['preferred_colors', 'fabric_preferences']
//         });

//         if (!babyInstance) return processedProducts;
//         const babyData = babyInstance.dataValues ? babyInstance.dataValues : babyInstance;

//         let prefColorIds = [];
//         let prefFabricIds = [];

//         try {
//             prefColorIds = typeof babyData.preferred_colors === 'string'
//                 ? JSON.parse(babyData.preferred_colors)
//                 : babyData.preferred_colors || [];
//         } catch (e) {
//             prefColorIds = [];
//         }

//         try {
//             prefFabricIds = typeof babyData.fabric_preferences === 'string'
//                 ? JSON.parse(babyData.fabric_preferences)
//                 : babyData.fabric_preferences || [];
//         } catch (e) {
//             prefFabricIds = [];
//         }

//         prefColorIds = prefColorIds.map(Number);
//         prefFabricIds = prefFabricIds.map(Number);

//         let prefColorNames = [];
//         if (prefColorIds.length > 0 && Color) {
//             const dbColors = await Color.findAll({
//                 where: { id: prefColorIds },
//                 attributes: ['name'],
//                 raw: true
//             });
//             prefColorNames = dbColors.map(c => {
//                 const nameVal = Array.isArray(c.name) ? c.name[0] : c.name;
//                 return String(nameVal || '').trim().toLowerCase();
//             }).filter(Boolean);
//         }

//         if (prefColorNames.length === 0 && prefFabricIds.length === 0) {
//             return processedProducts;
//         }

//         return processedProducts.sort((a, b) => {
//             let scoreA = 0;
//             let scoreB = 0;
//             // ==========================================
//             // PRODUCT A CHECKING
//             // ==========================================
//             // 1. Color NAME Matching (Product ke color.name array ke sath)
//             if (prefColorNames.length > 0 && a.color) {
//                 let productColorsA = Array.isArray(a.color.name) ? a.color.name : [a.color.name || ''];
//                 const hasColorA = productColorsA.some(c =>
//                     prefColorNames.includes(String(c).toLowerCase().trim())
//                 );
//                 if (hasColorA) scoreA += 5;
//             }
//             if (prefFabricIds.length > 0) {
//                 const fabricIdA = Number(a.fabric_id || a.fabric?.id);
//                 if (prefFabricIds.includes(fabricIdA)) scoreA += 3;
//             }
//             // ==========================================
//             // PRODUCT B CHECKING
//             // ==========================================
//             // 1. Color NAME Matching
//             if (prefColorNames.length > 0 && b.color) {
//                 let productColorsB = Array.isArray(b.color.name) ? b.color.name : [b.color.name || ''];
//                 const hasColorB = productColorsB.some(c =>
//                     prefColorNames.includes(String(c).toLowerCase().trim())
//                 );
//                 if (hasColorB) scoreB += 5;
//             }
//             if (prefFabricIds.length > 0) {
//                 const fabricIdB = Number(b.fabric_id || b.fabric?.id);
//                 if (prefFabricIds.includes(fabricIdB)) scoreB += 3;
//             }
//             return scoreB - scoreA;
//         });

//     } catch (error) {
//         console.error("Error in preference sorting logic:", error);
//         return processedProducts;
//     }
// };



// const shuffleArray = (array) => {
//     const shuffled = [...array];
//     for (let i = shuffled.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//     }
//     return shuffled;
// };

// const sortProductsByBabyPreference = async (products, babyId) => {
//     if (!products || products.length === 0) return [];
//     if (!babyId) return products;

//     try {
//         const babyInstance = await BabyProfile.findOne({
//             where: { id: babyId },
//             attributes: ['preferred_colors', 'fabric_preferences']
//         });

//         if (!babyInstance) return products;
//         const babyData = babyInstance.dataValues ? babyInstance.dataValues : babyInstance;

//         let prefColorIds = [];
//         let prefFabricIds = [];

//         try {
//             prefColorIds = typeof babyData.preferred_colors === 'string'
//                 ? JSON.parse(babyData.preferred_colors)
//                 : babyData.preferred_colors || [];
//         } catch (e) {
//             prefColorIds = [];
//         }

//         try {
//             prefFabricIds = typeof babyData.fabric_preferences === 'string'
//                 ? JSON.parse(babyData.fabric_preferences)
//                 : babyData.fabric_preferences || [];
//         } catch (e) {
//             prefFabricIds = [];
//         }
//         prefColorIds = prefColorIds.map(Number);
//         prefFabricIds = prefFabricIds.map(Number);
//         let prefColorNames = [];
//         if (prefColorIds.length > 0 && Color) {
//             const dbColors = await Color.findAll({
//                 where: { id: prefColorIds },
//                 attributes: ['name'],
//                 raw: true
//             });
//             prefColorNames = dbColors.map(c => {
//                 const nameVal = Array.isArray(c.name) ? c.name[0] : c.name;
//                 return String(nameVal || '').trim().toLowerCase();
//             }).filter(Boolean);
//         }

//         if (prefColorNames.length === 0 && prefFabricIds.length === 0) {
//             return [];
//         }

//         const getProductScore = (product) => {
//             let score = 0;
//             if (prefColorNames.length > 0 && product.color) {
//                 let productColors = Array.isArray(product.color.name) ? product.color.name : [product.color.name || ''];
//                 const hasColor = productColors.some(c =>
//                     prefColorNames.includes(String(c).toLowerCase().trim())
//                 );
//                 if (hasColor) score += 5;
//             }

//             if (prefFabricIds.length > 0) {
//                 const fabricId = Number(product.fabric_id || product.fabric?.id);
//                 if (prefFabricIds.includes(fabricId)) score += 3;
//             }
//             return score;
//         };

//         const matchingProducts = products.filter(product => {
//             const score = getProductScore(product);
//             product._tempScore = score;
//             return score > 0;
//         });

//         let processedProducts = shuffleArray(matchingProducts);
//         processedProducts.sort((a, b) => b._tempScore - a._tempScore);
//         processedProducts.forEach(p => delete p._tempScore);
//         return processedProducts;

//     } catch (error) {
//         console.error("Error in preference sorting logic:", error);
//         return [];
//     }
// };



const sortProductsByBabyPreference = async (products, babyId) => {
    if (!products || products.length === 0) return [];
    if (!babyId) return products;
    try {
        const babyInstance = await BabyProfile.findOne({
            where: { id: babyId },
            attributes: ['preferred_colors', 'fabric_preferences']
        });
        if (!babyInstance) return products;
        const babyData = babyInstance.dataValues ? babyInstance.dataValues : babyInstance;

        // let prefColorIds = [];
        // let prefFabricIds = [];

        // try {
        //     prefColorIds = typeof babyData.preferred_colors === 'string'
        //         ? JSON.parse(babyData.preferred_colors)
        //         : babyData.preferred_colors || [];
        // } catch (e) {
        //     prefColorIds = [];
        // }

        // try {
        //     prefFabricIds = typeof babyData.fabric_preferences === 'string'
        //         ? JSON.parse(babyData.fabric_preferences)
        //         : babyData.fabric_preferences || [];
        // } catch (e) {
        //     prefFabricIds = [];
        // }

         let rawColors = babyData.preferred_colors;
        let prefColorIds = [];

        if(Array.isArray(rawColors)) {
            prefColorIds = rawColors;
        } else if(typeof rawColors === 'string') {
            prefColorIds = safeJsonParse(rawColors, []);
        } else if(rawColors !== null && rawColors !== undefined) {

            prefColorIds = [rawColors];
        }


        let rawFabrics = babyData.fabric_preferences;
        let prefFabricIds = [];

        if(Array.isArray(rawFabrics)) {
            prefFabricIds = rawFabrics;
        } else if(typeof rawFabrics === 'string') {
            prefFabricIds = safeJsonParse(rawFabrics, []);
        } else if(rawFabrics !== null && rawFabrics !== undefined) {

            prefFabricIds = [rawFabrics];
        }

        prefColorIds = prefColorIds.map(Number);
        prefFabricIds = prefFabricIds.map(Number);

        let prefColorNames = [];
        if (prefColorIds.length > 0 && Color) {
            const dbColors = await Color.findAll({
                where: { id: prefColorIds },
                attributes: ['name'],
                raw: true
            });
            prefColorNames = dbColors.map(c => {
                const nameVal = Array.isArray(c.name) ? c.name[0] : c.name;
                return String(nameVal || '').trim().toLowerCase();
            }).filter(Boolean);
        }
        const getProductScore = (product) => {
            let score = 0;
            let hasPreferenceMatch = false;
            if (prefColorNames.length > 0 && product.color) {
                let productColors = Array.isArray(product.color.name) ? product.color.name : [product.color.name || ''];
                const hasColor = productColors.some(c =>
                    prefColorNames.includes(String(c).toLowerCase().trim())
                );
                if (hasColor) {
                    score += 5;
                    hasPreferenceMatch = true;
                }
            }

            if (prefFabricIds.length > 0) {
                const fabricId = Number(product.fabric_id || product.fabric?.id);
                if (prefFabricIds.includes(fabricId)) {
                    score += 3;
                    hasPreferenceMatch = true;
                }
            }

            const isBestSeller = product.is_best_seller === true || product.is_best_seller === 'true';
            if (isBestSeller) {
                score += 100;
            }
            return {
                score: score,
                isValid: isBestSeller || hasPreferenceMatch
            };
        };

        const matchingProducts = products.filter(product => {
            const result = getProductScore(product);
            product._tempScore = result.score;
            return result.isValid; 
        });

        let processedProducts = shuffleArray(matchingProducts);
        processedProducts.sort((a, b) => b._tempScore - a._tempScore);
        processedProducts.forEach(p => delete p._tempScore);
        return processedProducts;

    } catch (error) {
        console.error("Error in preference sorting logic:", error);
        return [];
    }
};

module.exports = { sortProductsByBabyPreference };
// const BabyProfile = require('../modals/babyProfileModal')

// const shuffleArray = (array) => {
//     const shuffled = [...array];
//     for (let i = shuffled.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//     }
//     return shuffled;
// };

// const sortProductsByBabyPreference = async (products, babyId) => {
//     console.log("babyId", babyId)
//     if (!products || products.length === 0) return [];

//     let processedProducts = shuffleArray(products);

//     if (!babyId) return processedProducts;

//     try {
//         const baby = await BabyProfile.findOne({
//             where: { id: babyId },
//             attributes: ['preferred_colors', 'fabric_preferences']
//         });
//             console.log("baby",baby)
//         if (!baby || (!baby.preferred_colors && !baby.fabric_preferences)) {
//             return processedProducts;
//         }
//         const prefColorName = baby.preferred_colors ? baby.preferred_colors.trim().toLowerCase() : null;
//         const prefFabricId = baby.fabric_preferences ? Number(baby.fabric_preferences) : null;
//         return processedProducts.sort((a, b) => {
//             let scoreA = 0;
//             let scoreB = 0;

//             if (prefColorName && a.color) {
//                 let colorsA = Array.isArray(a.color.name) ? a.color.name : [a.color.name || ''];
//                 const hasColorA = colorsA.some(c => String(c).toLowerCase().trim() === prefColorName);
//                 if (hasColorA) scoreA += 5;
//             }

//             if (prefFabricId && a.fabric) {
//                 const fabricIdA = Number(a.fabric.id || a.fabric_id);
//                 if (fabricIdA === prefFabricId) scoreA += 3;
//             }

//             if (prefColorName && b.color) {
//                 let colorsB = Array.isArray(b.color.name) ? b.color.name : [b.color.name || ''];
//                 const hasColorB = colorsB.some(c => String(c).toLowerCase().trim() === prefColorName);
//                 if (hasColorB) scoreB += 5;
//             }

//             if (prefFabricId && b.fabric) {
//                 const fabricIdB = Number(b.fabric.id || b.fabric_id);
//                 if (fabricIdB === prefFabricId) scoreB += 3;
//             }

//             return scoreB - scoreA;
//         });

//     } catch (error) {
//         console.error("Error in sorting/shuffling products:", error);
//         return processedProducts;
//     }
// };

// module.exports = { sortProductsByBabyPreference };






const BabyProfile = require('../modals/babyProfileModal');
const color = require('../modals/ProductModal/color')

const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};


const sortProductsByBabyPreference = async (products, babyId) => {
    if (!products || products.length === 0) return [];

    let processedProducts = shuffleArray(products);
    if (!babyId) return processedProducts;

    try {
        const babyInstance = await BabyProfile.findOne({
            where: { id: babyId },
            attributes: ['preferred_colors', 'fabric_preferences']
        });

        if (!babyInstance) return processedProducts;
        const babyData = babyInstance.dataValues ? babyInstance.dataValues : babyInstance;

        let prefColorIds = [];
        let prefFabricIds = [];

        try {
            prefColorIds = typeof babyData.preferred_colors === 'string'
                ? JSON.parse(babyData.preferred_colors)
                : babyData.preferred_colors || [];
        } catch (e) {
            prefColorIds = [];
        }

        try {
            prefFabricIds = typeof babyData.fabric_preferences === 'string'
                ? JSON.parse(babyData.fabric_preferences)
                : babyData.fabric_preferences || [];
        } catch (e) {
            prefFabricIds = [];
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

        if (prefColorNames.length === 0 && prefFabricIds.length === 0) {
            return processedProducts;
        }

        return processedProducts.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            // ==========================================
            // PRODUCT A CHECKING
            // ==========================================
            // 1. Color NAME Matching (Product ke color.name array ke sath)
            if (prefColorNames.length > 0 && a.color) {
                let productColorsA = Array.isArray(a.color.name) ? a.color.name : [a.color.name || ''];
                const hasColorA = productColorsA.some(c =>
                    prefColorNames.includes(String(c).toLowerCase().trim())
                );
                if (hasColorA) scoreA += 5; 
            }
            if (prefFabricIds.length > 0) {
                const fabricIdA = Number(a.fabric_id || a.fabric?.id);
                if (prefFabricIds.includes(fabricIdA)) scoreA += 3; 
            }
            // ==========================================
            // PRODUCT B CHECKING
            // ==========================================
            // 1. Color NAME Matching
            if (prefColorNames.length > 0 && b.color) {
                let productColorsB = Array.isArray(b.color.name) ? b.color.name : [b.color.name || ''];
                const hasColorB = productColorsB.some(c =>
                    prefColorNames.includes(String(c).toLowerCase().trim())
                );
                if (hasColorB) scoreB += 5;
            }
            if (prefFabricIds.length > 0) {
                const fabricIdB = Number(b.fabric_id || b.fabric?.id);
                if (prefFabricIds.includes(fabricIdB)) scoreB += 3;
            }
            return scoreB - scoreA;
        });

    } catch (error) {
        console.error("Error in preference sorting logic:", error);
        return processedProducts;
    }
};

module.exports = { sortProductsByBabyPreference };
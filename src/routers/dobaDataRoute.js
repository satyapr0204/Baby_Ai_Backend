const express = require('express');
const router = express.Router();
const { callDobaApi } = require('../../dobaApiCall');

router.post('/cloth-data', (req, res) => {
    console.log("Doba Data API called"); // Bas endpoint do, signing ye khud kar lega
    callDobaApi('/api/category/doba/list', { pageNo: 1, pageSize: 10 })
        .then(data => {
            console.log("Products:", data);
            res.send(data);
        })
        .catch(err => {
            console.log("Error:", err);
            res.status(500).send("Error fetching Doba data");
        });
});

module.exports = router;
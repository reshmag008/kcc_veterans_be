const express = require('express');
const playerService = require('../services/player');
const loginService = require('../services/login');
const teamService = require('../services/teams')
const bodyParser = require('body-parser');
const s3Service = require('../services/s3Service');
const router = express.Router();
const path = require('path');
const whatsappRouter = require("./whatsapp");

router.use("/webhook/whatsapp", whatsappRouter);
// const googleApisService = require('../services/googleApis')

const multer = require("multer");
// const gcsUpload = multer({ storage: multer.memoryStorage() });

const gcsUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // optional: 5MB limit
});

const { bucket } = require("../config/gcp_storage");




const imageStorage = multer.diskStorage({
    // Destination to store image     
    destination: 'public/player_images',
    filename: (req, file, cb) => {
        cb(null, req.body.file_name)
        // file.fieldname is name of the field (image)
        // path.extname get the uploaded file extension
    }
});


const imageUpload = multer({
    storage: imageStorage,
    limits: {
        fileSize: 1000000 // 1000000 Bytes = 1 MB
    },
    fileFilter(req, file, cb) {
        console.log("req=== ", req.body.file_name)
        if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
            // upload only png and jpg format
            return cb(new Error('Please upload a Image'))
        }
        cb(undefined, true)
    }
})

router.post("/gcsupload", gcsUpload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file");

        const fileName = req.body.file_name;

        const blob = bucket.file(fileName);


        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: {
                contentType: req.file.mimetype
            }
        });

        blobStream.on("error", (err) => {
            console.log("Blob Error:", err);
            res.status(500).json({ error: err.message });
        });
        console.log("bucket.name== ", bucket.name)
        blobStream.on("finish", () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            if(req?.body?.screenshot){
                playerService.updatePaymentScreenshot(req.body)
            }
            
            return res.status(200).json({ url: publicUrl });
        });

        blobStream.end(req.file.buffer);





    } catch (e) {
        console.log("catch error== ", e);
        res.status(500).send(e.message);
    }
});



router.post('/player_image_upload', imageUpload.single('image'), (req, res) => {
    console.log("req== ", req.body.file_name)
    console.log("inside player_image_upload")
    res.send(req.file)
}, (error, req, res, next) => {
    console.log("eror== ", error)
    res.status(400).send({ error: error.message })
})

router.post('/approve_player', (req, res) => {
    console.log(req.body)
    playerService.approvePlayers(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
}, (error, req, res, next) => {
    console.log("eror== ", error)
    res.status(400).send({ error: error.message })
})




router.get('/players', (req, res) => {
    console.log("req==", req.query)
    playerService.getPlayers(req.query)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/players/:id', (req, res) => {
    console.log(req.params)
    playerService.getPlayers(req.params)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});


router.get('/non_bid_players', (req, res) => {
    playerService.getNonBidPlayers()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/non_bid_players/:id', (req, res) => {
    playerService.getNonBidPlayers(req.params.id)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/sold_players', (req, res) => {
    playerService.getSoldPlayers(req.params.id)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/players', bodyParser.json(), (req, res) => {
    console.log(req.body)
    playerService.addPlayers(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/validate_league_login', bodyParser.json(), (req, res) => {
    console.log(req.body)
    loginService.validateLeagueOwnerLogin(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});


router.post('/player_display', bodyParser.json(), (req, res) => {
    console.log(req.body)
    playerService.displayPlayer(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/display_team_scores', bodyParser.json(), (req, res) => {
    playerService.displayTeamScores()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/team_call', bodyParser.json(), (req, res) => {
    console.log(req.body)
    playerService.teamCall(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/team_complete', bodyParser.json(), (req, res) => {
    console.log(req.body)
    playerService.teamComplete(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/close_popup', bodyParser.json(), (req, res) => {
    playerService.closePopup()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.put('/players', bodyParser.json(), (req, res) => {
    console.log(req.body)
    playerService.updatePlayers(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/upload', bodyParser.json(), (req, res) => {
    console.log(req.body)
    s3Service.getUploadUrl(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/download', bodyParser.json(), (req, res) => {
    console.log(req.body)
    s3Service.getDownloadUrl(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/teams', (req, res) => {
    teamService.getTeams()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/teams', bodyParser.json(), (req, res) => {
    console.log(req.body)
    teamService.addTeams(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/teamNames', (req, res) => {
    teamService.getTeamNames()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/update_unsold', (req, res) => {
    playerService.updateUnSold()
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/autheticateTeam/:code', (req, res) => {
    teamService.getTeamAuthenticated(req.params.code)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.post('/add_bid_history', bodyParser.json(), (req, res) => {
    console.log(req.body)
    teamService.addBidHistory(req.body)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});

router.get('/get_bid_history/:playerId', (req, res) => {
    teamService.getBidHistory(req.params.playerId)
        .then((result) => res.status(200).json(result))
        .catch((err) => res.status(500).json(err))
});


// router.post('/google-upload-file',imageUpload.single('image'),(req, res) => {
//     googleApisService.uploadFile(req.body,req.file)
//     .then((result) => res.status(200).json(result))
//     .catch((err) => res.status(500).json(err))
// });

// router.get('/preview-file/:fileId',(req, res) => {
//     console.log("req.params= ", req.params)
//     googleApisService.previewFile(req.params.fileId)
//     .then((result) => res.status(200).json(result))
//     .catch((err) => res.status(500).json(err))
// });




module.exports = router;
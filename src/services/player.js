
const models = require('../models');
const { Op,Sequelize, where } = require("sequelize");
const AWS = require('aws-sdk');
const teamService = require('./teams');
const s3Service = require('./s3Service');
// const {io} = require('../app');
const {roomId} = require('../config/constants');
const whatsappService = require('./whatsappService');


async function displayPlayer(player){
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Emitting current_player to room: display player", roomId);

            if (global?.io) {
                global.io.to(roomId).emit("current_player",  JSON.stringify(player));
            }
            console.log("player== ", player)
            if(player.id){
                let selectedPlayer = await models.players.findOne({where : {id : player.id}});
                selectedPlayer.set({"profile_link" : "1"});
                await selectedPlayer.save();
                resolve(selectedPlayer)
            }else{
                resolve("No Player ID")
            }


            
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}

async function teamCall(teamCallData){
    return new Promise(async (resolve, reject) => {
        try {
            global.io.to(roomId).emit('team_call', JSON.stringify(teamCallData))
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}

async function teamComplete(teamData){
    return new Promise(async (resolve, reject) => {
        try {
            global.io.to(roomId).emit('team_complete', JSON.stringify(teamData))
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}

async function emitCurrentBid(teamData){
    return new Promise(async (resolve, reject) => {
        try {
            global.io.to(roomId).emit('current_bid', JSON.stringify(teamData))
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}


async function emitCallStage(state){
    return new Promise(async (resolve, reject) => {
        try {
            console.log("state== ", state)
            global.io.to(roomId).emit('call_stage', JSON.stringify(state))
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}



async function closePopup(){
    return new Promise(async (resolve, reject) => {
        try {
            global.io.to(roomId).emit('close_popup')
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}


async function getSoldPlayers(){
    return new Promise(async (resolve, reject) => {
        try {
            let players = await models.players.findAll({
                where: {
                  bid_amount: {
                    [Sequelize.Op.not]: 0
                  }
                },order: [['updatedAt', 'DESC']], limit:10
              });
            let promiseArray =[];
            let teamPromiseArray = [];
            players.forEach(async (element,index) => {
                // promiseArray.push(s3Service.getDownloadUrl({"key" : element.profile_image, "bucket" : "palloor-players"}))
                teamPromiseArray.push(models.teams.findOne({where:{id : element.team_id}}))
            });
            // let profilePromises = await Promise.allSettled(promiseArray);
            let teamPromises = await Promise.allSettled(teamPromiseArray);
            if(players.length>0){
            players.forEach((element,index)=>{
                // players[index]['profile_image'] = profilePromises[index].value;
                // console.log("teamPromises[index].value== ", teamPromises[index].value);
                players[index]['team_id'] = teamPromises[index]?.value?.team_name
            })

            let response = {
                players : players
            }
            resolve(response);
        }else{
            resolve(players)
        }
            
        }catch(e){
            console.log("error occured in getPlayers= ", e);
            reject(e);
        }
    })
}

async function getPlayers(params){
    console.log("params== ",params)
    return new Promise(async (resolve, reject) => {
        try {
            let players =[];
            if(params.id){
                players = await models.players.findAll({where :{team_id : params.id},order: [["updatedAt", "DESC"]]});
            }else{
                players = await models.players.findAll({ 
                    limit : Number(params.limit),
                    offset : Number(params.offset)
                });
            }

            // let promiseArray =[];
            // players.forEach(async (element,index) => {
            //     promiseArray.push(s3Service.getDownloadUrl({"key" : element.profile_image, "bucket" : "palloor-players"}))
            // });
            // let profilePromises = await Promise.allSettled(promiseArray);
            if(players.length>0){

            // players.forEach((element,index)=>{
            //     players[index]['profile_image'] = profilePromises[index].value;
            // })

            
            let unSoldPlayerCount = await models.players.count({where: {un_sold : true} });
            let soldPlayerCount = await models.players.count({where: {
                bid_amount: {
                  [Op.not]: 0
                }
              }})
            let pendingPlayerCount = await models.players.count({where:{
                bid_amount : 0 ,
                un_sold : false
            }})

            let response = {
                players : players,
                unSoldPlayerCount:unSoldPlayerCount,
                soldPlayerCount:soldPlayerCount,
                pendingPlayerCount:pendingPlayerCount
            }
            resolve(response);
        }else{
            resolve(players)
        }
            
        }catch(e){
            console.log("error occured in getPlayers= ", e);
            reject(e);
        }
    })
}

async function getNonBidPlayers(id) {

    return new Promise(async (resolve, reject) => {
        try {
            let players =[];

            if(id){
                players = await models.players.findOne({
                    where: {
                      bid_amount: 0,
                      id : id,
                      un_sold : false
                    },
                    order: models.sequelize.random()
                  });
            }else{
                players = await models.players.findOne({
                    where: {
                      bid_amount: 0,
                      un_sold : false
                    },
                    order: models.sequelize.random()
                  });
            }
            // let promiseArray =[];
            // if(players.length>0){
            //     players.forEach(async (element,index) => {
            //         promiseArray.push(s3Service.getDownloadUrl({"key" : element.profile_image, "bucket" : "palloor-players"}))
            //     });
            //     let profilePromises = await Promise.allSettled(promiseArray)

            //     players.forEach((element,index)=>{
            //         players[index]['profile_image'] = profilePromises[index].value;

            //         if(index == players.length-1){
            //             resolve(players)
            //         }
            //     })
            // }else{
            //     resolve([])
            // }

            resolve(players);
            
        }catch(e){
            console.log("error occured in getPlayers= ", e);
            reject(e);
        }
    })


}

async function addPlayers(player){
    return new Promise(async (resolve, reject) => {
        try {
            let players = await models.players.create(player);
            // let wahtsappResponse = await whatsappService.sendWhatsAppWelcomeMessage(players.fullname,players.id,players.whatsapp_no);
            // resolve({players:players, wahtsappResponse:wahtsappResponse})
            resolve(players);
        }catch(e){
            console.log("error occured in addPlayers= ", e);
            reject(e);
        }
    })
}

async function updatePlayers(player){
    return new Promise(async (resolve, reject) => {
        try {
            let selectedPlayer = await models.players.findOne({where : {id : player.id}});
            selectedPlayer.set(player);
            await selectedPlayer.save();
            let updateTeam;
            if(player.team_id){
                let updateTeamParam = {
                    id : player.team_id,
                    bid_amount : player.bid_amount
                }
                updateTeam = await teamService.updateTeam(updateTeamParam)
            }
            // if(player.un_sold){
            //     global.io.to(roomId).emit('player_unsold', JSON.stringify(player))
            // }else{
            //     global.io.to(roomId).emit('player_sold', JSON.stringify(player))
            // }
            
            resolve(updateTeam)
        }catch(e){
            console.log("error occured in addPlayers= ", e);
            reject(e);
        }
    })
}

async function updatePaymentScreenshot(params){
    return new Promise(async (resolve, reject) => {
        try {
            console.log("inside update updatePaymentScreenshot")
            let resp = await models.players.update({payment_screenshot:params.screenshot},{where:{id:params.player_id}});
            console.log("resp== ", resp);
            resolve(resp);
        }catch(e){
            reject(e)
        }
    })

}

async function updateUnSold(){
    return new Promise(async (resolve, reject) => {
        try {
            console.log("inside update unsoldddddddddddddddd")
            let resp = await models.players.update({un_sold:false},{where:{un_sold:true}});
            console.log("resp== ", resp);
            resolve(resp);
        }catch(e){
            reject(e)
        }
    })

}


async function approvePlayers(params) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("inside update approvePlayers")
            let resp = await models.players.update({status:2},{where:{id:params.id}});
            console.log("resp== ", resp);
            let selectedPlayer = await models.players.findOne({where : {id : params.id}});
            resolve(selectedPlayer);
        }catch(e){
            reject(e)
        }
    })
}

async function displayTeamScores(){
    return new Promise(async (resolve, reject) => {
        try {
            global.io.to(roomId).emit('display_team_scores')
            resolve('success')
        }catch(e){
            console.log("error occured in displayPlayer= ", e);
            reject(e);
        }
    })
}

async function getCurrentPlayer() {
    return new Promise(async (resolve, reject) => {
        try {
           const selectedPlayer = await models.players.findOne({
                 where: { profile_link: "1" },
                 order: [["updatedAt", "DESC"]],
               });
            resolve(selectedPlayer)
        }catch(e){
            reject(e)
        }
    })
}




module.exports = {
    getCurrentPlayer:getCurrentPlayer,
    getPlayers : getPlayers,
    addPlayers : addPlayers,
    updatePlayers : updatePlayers,
    getNonBidPlayers :getNonBidPlayers,
    displayPlayer : displayPlayer,
    teamCall : teamCall,
    getSoldPlayers : getSoldPlayers,
    teamComplete :teamComplete,
    updateUnSold:updateUnSold,
    closePopup:closePopup,
    displayTeamScores :displayTeamScores,
    updatePaymentScreenshot : updatePaymentScreenshot,
    approvePlayers:approvePlayers,
    emitCurrentBid:emitCurrentBid,
    emitCallStage:emitCallStage
};
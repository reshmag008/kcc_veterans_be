const models = require('../models');
const { Op,Sequelize } = require("sequelize");
const AWS = require('aws-sdk');
const playerService = require('./player')
const s3Service = require('./s3Service');
const {roomId} = require('../config/constants');




async function getTeams(){
    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.teams.findAll();
            // let promiseArray =[];
            // let promiseCountArray = [];
            // teams.forEach(async (element,index) => {
            //     promiseArray.push(s3Service.getDownloadUrl({"key" : element.team_logo, "bucket" : "palloor-teams"}))
            // });
            // let profilePromises = await Promise.allSettled(promiseArray)
            // let teamArray = [...teams];
            // teamArray.forEach((element,index)=>{
            //     teamArray[index]['team_logo'] = profilePromises[index].value;
            //     if(index == teamArray.length-1){
            //         resolve(teamArray)
            //     }
            // })
            resolve(teams);
        }catch(e){
            console.log("error occured in getTeams= ", e);
            reject(e);
        }
    })
}

async function addTeams(team){
    return new Promise(async (resolve, reject) => {
        try {
            let addedTeam = await models.teams.create(team);
            resolve(addedTeam)
        }catch(e){
            console.log("error occured in addTeams= ", e);
            reject(e);
        }
    })
}


async function updateTeam(team){
    console.log("inside add --- ", team);
    return new Promise(async (resolve, reject) => {
        try {
            let addedTeam = await models.teams.findOne({where:{id : team.id}});
            let updateParam = {
                total_points : addedTeam.total_points - team.bid_amount,
                player_count : addedTeam.player_count + 1,
                max_bid_amount : (addedTeam.total_points - team.bid_amount) - (  (10 - (addedTeam.player_count+1) ) * 1000 ) 
            }
            addedTeam.set(updateParam);
            await addedTeam.save();
            // let team_logo = await s3Service.getDownloadUrl({"key" : addedTeam.team_logo, "bucket" : "palloor-teams"})
            // addedTeam.team_logo = team_logo;
            resolve(addedTeam)
        }catch(e){
            console.log("error occured in addTeams= ", e);
            reject(e);
        }
    })
}

async function getTeamNames() {

    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.teams.findAll();
            resolve(teams);
        }catch(e){
            console.log("error occured in getTeams= ", e);
            reject(e);
        }
    })



}

async function getTeamAuthenticated(code) {

    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.teams.findOne({where : {auction_code : code} });
            resolve(teams);
        }catch(e){
            console.log("error occured in getTeams= ", e);
            reject(e);
        }
    })

}


async function addBidHistory(bid){
    return new Promise(async (resolve, reject) => {
        try {
            let addedBid = await models.bid_history.create(bid);
            resolve(addedBid)
        }catch(e){
            console.log("error occured in addBidHistory= ", e);
            reject(e);
        }
    })
}


async function getBidHistory(playerId) {

    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.bid_history.findAll({where : {player_id : playerId} ,order: [["updatedAt", "DESC"]],});
            resolve(teams);
        }catch(e){
            console.log("error occured in getBidHistory= ", e);
            reject(e);
        }
    })

}

async function addAuctionState(auctionState){
    return new Promise(async (resolve, reject) => {
        try {
            let addedBid = await models.auction_state.create(auctionState);
            resolve(addedBid)
        }catch(e){
            console.log("error occured in addBidHistory= ", e);
            reject(e);
        }
    })
}

async function getAuctionState(playerId) {
    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.auction_state.findAll({where : {playerId : playerId}});
            resolve(teams);
        }catch(e){
            console.log("error occured in getAuctionState= ", e);
            reject(e);
        }
    })
}

async function getAuctionStateByRoom(roomId) {
    return new Promise(async (resolve, reject) => {
        try {
            let teams = await models.auction_state.findOne({where : {roomId : roomId} ,order: [["updatedAt", "DESC"]] });
            resolve(teams);
        }catch(e){
            console.log("error occured in getAuctionState= ", e);
            reject(e);
        }
    })
}


async function updateAuctionState(params) {
    return new Promise(async (resolve, reject) => {
        try {
            let auctionState = await models.auction_state.findOne({where:{playerId : params.playerId}});
            auctionState.set(params);
            await auctionState.save();
            resolve(auctionState)
        }catch(e){
            console.log("error occured in updateAuctionState= ", e);
            reject(e);
        }
    })
}



module.exports = {
    getTeams : getTeams,
    addTeams : addTeams,
    getTeamNames:getTeamNames,
    updateTeam :  updateTeam,
    getTeamAuthenticated:getTeamAuthenticated,
    addBidHistory:addBidHistory,
    getBidHistory:getBidHistory,
    addAuctionState:addAuctionState,
    getAuctionState:getAuctionState,
    updateAuctionState:updateAuctionState,
    getAuctionStateByRoom:getAuctionStateByRoom
}
var express = require('express');  
var bodyParser = require('body-parser');  
var request = require('request');
var qs = require('querystring');
var schedule = require('node-schedule');
var app = express();
var mongoose = require('mongoose');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: false}));  
app.use(bodyParser.json());  
app.listen((process.env.PORT || 8080));

var user = {};
var Total = [];
var Detail = [];
var kind = 'hospital';
var result = 'None';
var Kinddi = [];
var Category = [];

mongoose.connect(process.env.MONGODB_URI);
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    id : Number,
    disease : String,
    published_date : Date
});

var UserModel = mongoose.model("users", UserSchema);

var db = {};

var disease_name=["Disease_name"];

app.get('/', function (req, res) {
    res.render('pages/index');
});

app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'VERIFY_TOKEN') {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Invalid verify token');
    }
});

app.post('/webhook', function (req, res) {
    var data = req.body;
    if (data.object === 'page') {
        data.entry.forEach(function (pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;
            pageEntry.messaging.forEach(function (messagingEvent) {
                var ID = messagingEvent.sender.id;
                if (messagingEvent.message) {
                    if (messagingEvent.message.text) {
                        var temp = messagingEvent.message.text;
                        if (temp === "기능" ||
                            temp === "돌아가기") {
                            sendGenericMessagefirst(ID);
                        }
                        else if (temp === "초기화") {
                            user[ID] = 'undefined';
                            if (db[ID]) delete db[ID];
                            if (user[ID] === 'undefined') {
                                user[ID] = 'register';
                                sendMessage(ID, {text: "HealthyBot입니다. '기능'을 입력하면 여러 기능을 한눈에 확인할 수 있습니다."});
                            }
                        }
                        else if(user[ID] === 'disease' && temp){
                                if (!db[ID]) db[ID] = { result: [] };
                                user[ID] = 'register';
                                sendLuis(ID,temp);
                        }
                        else if(user[ID] === 'More_more' && temp){
                            MoreInput(ID,temp);
                        }
                        else if(messagingEvent.message.quick_reply){
                            var reply = messagingEvent.message.quick_reply;
                            var date = new Date();
                            var year = date.getFullYear();
                            var month = date.getMonth();
                            var day = date.getDate();
                            var hour = date.getHours();
                            var minute = date.getMinutes();
                            var second = date.getSeconds();
                            if(reply.payload === "two"){
                                var new_day = new Date(year,month,day,hour,minute,second+10);
                                var a = schedule.scheduleJob(new_day,function() {
                                    var ans = new Date();
                                    sendMessage(ID, {text: "병원 예약날입니다."+ans.toLocaleDateString()});
                                });
                                sendMessage(ID,{text: "내일로 예약되었습니다" });
                            }
                            else if(reply.payload === "three"){
                                var new_date = new Date(year,month,day+2,hour,minute,second);
                                var b = schedule.scheduleJob(new_date,function(){
                                    ans = new Date();
                                    sendMessage(ID, {text: "병원 예약날입니다."+ans.toLocaleDateString()});
                                });
                                sendMessage(ID,{text: "모레로 예약되었습니다" });
                            }
                        }
                        else {
                            sendMessage(ID, {text: "무슨말인지 모르겠어요..다시입력해주세요(기능을 확인하시려면 '기능'을 입력해주세요:)"});
                        }
                    }
                    else if (messagingEvent.message.attachments && messagingEvent.message.attachments.length > 0) {
                        var attachment = messagingEvent.message.attachments[0];
                        if (attachment.type === 'location') {
                            var lat = attachment.payload.coordinates.lat;
                            var long = attachment.payload.coordinates.long;
                            lat = lat.toFixed(6),long = long.toFixed(6);
                            NearHospital(ID,lat,long,kind);
                        }
                    }
                }
                else if (messagingEvent.postback) {
                    if (messagingEvent.postback.payload === "Find_hospital") {
                        sendLocation(ID);
                    }
                    else if (messagingEvent.postback.payload === "Know_prev") {
                        FindDB(ID);
                    }
                    else if (messagingEvent.postback.payload === "Search_d") {
                        sendGenericMessagesecond(ID);
                    }
                    else if(messagingEvent.postback.payload === "Every_di"){
                        user[ID] = 'disease';
                        kind = 'hospital';
                        sendMessage(ID, {text: "증상을 입력해주세요"});
                    }
                    else if(messagingEvent.postback.payload === "Before_function"){
                        sendGenericMessagefirst(ID);
                    }
                    else if (messagingEvent.postback.payload === "More_input") {
                        user[ID] = 'More_more';
                        sendMessage(ID, {text: "증상을 입력해주세요"});
                    }
                    else if (messagingEvent.postback.payload === "End_input") {
                        user[ID] = 'register';
                        var txt = db[ID].result[0].intent;
                        sendMessage(ID, {text: txt + "입니다"});
                        if(txt != 'None' || txt != 'none'){SaveDB(ID,txt);}
                        sendCategory(ID,txt);
                    }
                    else if (messagingEvent.postback.payload === "More_info") {
                        sendDiseaseImage(ID);
                    }
                    else if(messagingEvent.postback.payload === "choice0"){
                        sendDetail(ID,0);
                    }
                    else if(messagingEvent.postback.payload === "Select0"){
                        var temp_intent = db[ID].result[0].intent;
                        sendCategory(ID,temp_intent);
                    }
                }
            });
        });
    }
    res.sendStatus(200);
});

function sendMessage(recipientId, message) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: message
        }
    },function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function sendGenericMessagefirst(recipientId){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: {
                attachment : {
                    type: "template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title: "안녕하세요:D HealthyBot입니다. 기능을 선택하세요",
                            buttons:[
                                {
                                    type: "postback",
                                    title: "지난 진단결과 확인",
                                    payload:"Know_prev"
                                },
                                {
                                    type: "postback",
                                    title: "증상검색",
                                    payload:"Search_d"
                                }
                            ]
                        }]
                    }
                }
            }   
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function sendGenericMessagesecond(recipientId){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: {
                attachment : {
                    type: "template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title: "증상을 입력해주세요",
                            buttons:[
                                {
                                    type: "postback",
                                    title: "입력",
                                    payload:"Every_di"
                                },
                                {
                                    type : "postback",
                                    title: "이전 기능",
                                    payload: "Before_function"
                                }
                            ]
                        }]
                    }
                }
            }   
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function sendLocation(recipientId){
    request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message : {
                text : "현재 위치를 공유해주세요",
                quick_replies:[
                    {content_type:"location" }
                ]
            }              
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function NearHospital(recipientId,lat,long,keyword){
    var val = qs.escape(keyword);
    request({
        url: "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + lat + "," + long+"&radius=500&type=hospital&keyword="+val+"&key=" + process.env.GOOGLE_KEY,
        method: 'GET'
    },function(error,response,body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else if(body && typeof body == "string"){
            body = JSON.parse(body);
            if(body.status == "OK"){
                Total.splice(0,Total.length);
                Total = body.results;
                sendImage(recipientId,lat,long);
            }
            else{
                sendMessage(recipientId,{text:'주변 병원이 없습니다'});
            }
        }
    });
}

function sendImage(recipientId,lat,long){
    var new_url = "https://maps.googleapis.com/maps/api/staticmap?center="+lat+","+long+"&zoom=15&size=400x400&maptype=roadmap&markers=color:blue%7Clabel:S%7C"+lat+","+long;
    for(var i = 0; i < Total.length; i++) {
        var new_lat = Total[i].geometry.location.lat,
            new_lng = Total[i].geometry.location.lng;
        new_lat = new_lat.toFixed(6),new_lng = new_lng.toFixed(6);
        new_url = new_url+"&markers=color:red%7Clabel:C%7C"+new_lat+","+new_lng;
    }
    new_url = new_url+"&key="+process.env.GOOGLE_KEY;
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: {
                attachment:{
                    type:"image",
                    payload:{
                        url: new_url
                    }
                }
            }
        }
    },function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
        else sendHospital(recipientId);
    });
}

function sendHospital(recipientId){
    if(Total.length > 0) {
        var array = [];
        for (var i = 0; i < Total.length; i++) {
            array.push({
                title: Total[i].name,
                subtitle: "주소:" + Total[i].vicinity,
                image_url: Total[i].icon,
                buttons: [{
                    type: "postback",
                    title: "선택",
                    payload: "choice" + i
                }]
            });
        }
        var Data = {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: array
                }
            }
        };
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: recipientId},
                message: Data
            }
        }, function (error, response, body) {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
        });
    }
    else{
        sendMessage(recipientId,{text:"주변 병원이 없습니다."});
    }
}

function sendDetail(recipientId,number){
    request({
        url: "https://maps.googleapis.com/maps/api/place/details/json?placeid="+Total[number].place_id+"&key="+process.env.GOOGLE_KEY,
        method: 'GET'
    },function(error,response,body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else if(body && typeof body == "string"){
            body = JSON.parse(body);
            if(body.status == "OK"){
                Detail = [];
                //Detail.splice(0,Detail.length);
                Detail = body.result;
                if(Detail.website){
                    MoreDetail(recipientId);
                }
                else{
                    SomeDetail(recipientId);
                }
            }
            else{
                sendMessage(recipientId,{text:'세부정보가 나와있지 않습니다.'});
            }
        }
    });
}

function SomeDetail(recipientId){
    var name = "병원이름 : "+Detail.name,
        url = Detail.icon,
        sub = "병원주소 : "+Detail.formatted_address;
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:recipientId},
            message:{
                attachment:{
                    type:"template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title:name,
                            image_url:url,
                            subtitle:sub,
                            buttons:[
                                {
                                    type:"postback",
                                    title:"예약하기",
                                    payload:"reserve"
                                }
                            ]
                        }]
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function MoreDetail(recipientId){
    var name = "병원이름 : "+Detail.name,
        url = Detail.icon,
        sub = "병원주소 : "+Detail.formatted_address,
        web = Detail.website,
        call = Detail.international_phone_number;

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:recipientId},
            message:{
                attachment:{
                    type:"template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title:name,
                            image_url:url,
                            subtitle:sub,
                            buttons:[
                                {
                                    type:"web_url",
                                    title:"병원 웹사이트로 이동",
                                    url:web
                                },{
                                    type:"phone_number",
                                    title:"전화연결하기",
                                    payload:call
                                },
                                {
                                    type:"postback",
                                    title:"예약하기",
                                    payload:"reserve"
                                }
                            ]
                        }]
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function sendLuis(recipientId, message){
    var encode = qs.escape(message);
    var Url = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/"+LUIS.APP_ID+"?subscription-key="+KEY+"&timezoneOffset=540&verbose=true&q="+encode;
    request({
        url: Url,
        method: 'GET'
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else if(body && typeof body == "string"){
            body = JSON.parse(body);
            if(body.intents.length > 0) {
                Kinddi = body.intents;
                if(Kinddi.length >= 2){
                    Kinddi.sort(function(a,b){
                        return a.score < b.score ? 1 : a.score > b.score? -1 : 0;
                    });
                }
                var j = 0;
                for(var i = 0; i < Kinddi.length; i++){
                    if(Kinddi[i].intent != 'None' && Kinddi[i].intent != 'none' ) {
                        db[recipientId].result[j] = Kinddi[i];
                        j++;
                    }
                }
                MoreDisease(recipientId);
            }
            else{
                sendMessage(recipientId,{text:"분석된 증상이 없습니다 다시입력해주세요"});
                MoreDisease(recipientId);
            }
        }
    });
}

function sendCategory(recipientId, message){
    var encode2 = qs.escape(message);
    var Url2 = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/"+LUIS.APP_ID+"?subscription-key="+KEY+"&timezoneOffset=540&verbose=true&q="+encode2;
    request({
        url: Url2,
        method: 'GET'
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else if(body && typeof body == "string"){
            body = JSON.parse(body);
            if(body.intents.length > 0) {
                kind = body.topScoringIntent.intent;
                sendMessage(recipientId, {text: kind + "입니다"});
                locationButton(recipientId);
            }
            else{
                sendMessage(recipientId,{text:"해당하는 분류(과)가 없습니다."});
                locationButton(recipientId);
            }
        }
    });
}

function MoreDisease(recipientId){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message : {
                attachment : {
                    type: "template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title:"증상을 더 입력해주세요",
                            buttons:[
                                {
                                    type:"postback",
                                    title:"더 입력",
                                    payload:"More_input"
                                },
                                {
                                    type:"postback",
                                    title:"그만 입력",
                                    payload:"End_input"
                                }
                            ]
                        }]
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function MoreInput(recipientId,message){
    var encode = qs.escape(message);
    var Url = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/"+LUIS.APP_ID+"?subscription-key="+KEY+"&timezoneOffset=540&verbose=true&q="+encode;
    request({
        url: Url,
        method: 'GET'
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        } else if(body && typeof body == "string"){
            body = JSON.parse(body);
            if(body.intents.length > 0) {
                //result = body.topScoringIntent.intent;
                var temp_result = body.intents;
                for(var i = 0; i < temp_result.length; i++){
                    var flag = false;
                    for(var j = 0; j < db[recipientId].result.length; j++){
                        if(db[recipientId].result[j].intent === temp_result[i].intent){
                            db[recipientId].result[j].score += temp_result[i].score;
                            flag = true;
                        }
                    }
                    if(flag === false && temp_result[i].intent != 'None' && temp_result[i].intent != 'none'){
                        db[recipientId].result[db[recipientId].result.length] = temp_result[i];
                    }
                }

                if(db[recipientId].result.length >= 2){
                    db[recipientId].result.sort(function(a,b){
                        return a.score < b.score ? 1 : a.score > b.score? -1 : 0;
                    });
                }
                MoreDisease(recipientId);
            }
            else{
                sendMessage(recipientId,{text:"분석된 증상이 없습니다 다시입력해주세요"});
                MoreDisease(recipientId);
            }
        }
    });
}

function sendDiseaseImage(recipientId){
    if(db[recipientId].result.length > 0) {
        var array1 = [];
        for (var t = 0; t < 5; t++) {
            var image_number = 40;
            for(var s = 0; s < 39; s++){
                if(disease_name[s] === db[recipientId].result[t].intent){
                    image_number = s;
                    break;
                }
            }
            var imageurl = your_project_s3_address+image_number+".png";
            var All_url = "https://ko.wikipedia.org/wiki/"+qs.escape(db[recipientId].result[t].intent);
            array1.push({
                title: db[recipientId].result[t].intent,
                subtitle: db[recipientId].result[t].score,
                image_url : imageurl,
                buttons:[
                    {
                    type: "postback",
                    title: "병명선택",
                    payload: "Select"+t
                    },
                    {
                        type: "web_url",
                        url: All_url,
                        title: "전문보기",
                        webview_height_ratio : "compact"
                    }
                ]
            });
        }
        var Data1 = {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: array1
                }
            }
        };
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: recipientId},
                message: Data1
            }
        }, function (error, response, body) {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
        });
    }
    else{
        sendMessage(recipientId,{text: "더이상 해당하는 병명이 없습니다."});
    }
}

function locationButton(recipientId){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message : {
                attachment : {
                    type: "template",
                    payload:{
                        template_type:"generic",
                        elements:[{
                            title: "버튼을 클릭하면 증상에 맞는 주변 병원을 알려드립니다",
                            buttons:[
                                {
                                    type:"postback",
                                    title:"증상관련 다른 병명 선택하기",
                                    payload:"More_info"
                                },
                                {
                                    type:"postback",
                                    title:"주변 병원 찾기",
                                    payload:"Find_hospital"
                                }
                            ]
                        }]
                    }
                }
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

function Reserve(recipientId){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message:{
                text:"예약 날짜를 선택해주세요",
                quick_replies:[
                    {
                        content_type:"text",
                        title:"내일",
                        payload:"two"
                    },
                    {
                        content_type:"text",
                        title:"모레",
                        payload:"three"
                    }
                ]
            }
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });

}

function SaveDB(recipientId,result){
    var instance = new UserModel({
        id : recipientId,
        disease : result,
        published_date : new Date()
    });

    instance.save(function(err,instance){
        if(err) sendMessage(recipientId,{text:"저장할 수 없습니다."});
        console.dir(instance);
    });
}

function FindDB(recipientId){
    UserModel.find({id: recipientId},function(err,docs){
        for(var i = 0,size = docs.length; i < size; i++){
            var talk = "고객님은 "+docs[i].published_date.toLocaleDateString()+" 에 "+docs[i].disease + " 을 진단받으셨습니다";
            sendMessage(recipientId,{text:talk});
        }
    });
}

module.exports = app;

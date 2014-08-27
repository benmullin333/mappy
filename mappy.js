/**
 *
 *
 * useful example ES queries
 *
 *
 * THESE NEXT TWO ARE REQUIRED TO SETUP THE INDEX
 *
 curl -XPUT localhost:9200/rides
 curl -XPUT localhost:9200/rides/route/_mapping -d '{ "route" : { "properties": {"start" : {"type": "geo_point"}, "destination" : {"type": "geo_point"}}}}'

 *THESE ARE EXAMPLES OF VALID SETS AND QUERIES
 *
 curl -XPUT localhost:9200/rides/route/409?ttl=600 -d '{ "start" : { "lat": 10, "lon":10 }, "destination" : { "lat": 11, "lon" :11} }'
 curl -XPUT localhost:9200/rides/route/410?ttl=600 -d '{ "start" : { "lat": 10.01, "lon":10 }, "destination" : { "lat": 11.01, "lon" :11} }'
 curl -XPUT localhost:9200/rides/route/4091?ttl=600 -d '{ "start" : { "lat": 10.02, "lon":10 }, "destination" : { "lat": 11.02, "lon" :11} }'
 curl -XPUT localhost:9200/rides/route/4092?ttl=600 -d '{ "start" : { "lat": 10.03, "lon":10 }, "destination" : { "lat": 11.03, "lon" :11} }'

 curl -XGET 'localhost:9200/rides/route/_search' -d '{"query": { "match_all" :{}}, "filter" : { "geo_distance":{ "distance": "1km", "start" :{"lat": 10, "lon":10}}}}'

 curl -XGET 'localhost:9200/rides/route/_search' -d '{"query": { "match_all" :{}}, "filter" : { "geo_distance":{ "distance": "100km", "start" :{"lat": 10, "lon":10},"destination": {"lat": 10, "lon":10}}}}'


 curl -XGET 'localhost:9200/rides/route/_search' -d '{"sort" : [{"_geo_distance": {"start":[10,10], "order":"asc","unit":"km"}},{"_geo_distance": {"destination":[10,10], "order":"asc","unit":"km"}}],"query": { "match_all" :{}}, "filter" : { "geo_distance":{ "distance": "10km", "start" :{"lat": 10, "lon":10},"destination": {"lat": 10, "lon":10}}}}' *
 *
 */
var http = require('http');
var fs = require('fs');  //file stream
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;  //node implimentation of the popular library

//FOR THE PURPOSES OF DEMONSTRATION, ODDS OF USER ID COLLISION ARE LOW, BUT NOT IMPOSSIBLE
function quickDirtyUser (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    if (list.user != null) {
        user = list.user;
    } else {
        user = Math.floor(Math.random()*1000000);
    }
    return user;
}

function setTrip(user, location, destination) {
    var xhttp = new XMLHttpRequest();
    var url =  'http://localhost:9200/rides/route/' + user + '?ttl=600';
    var params = '{ "start" : "'+ location +'" , "destination" : "'+ destination +'"}';
    xhttp.open("POST", url, true);
    xhttp.setRequestHeader("Content-type", "application/json");

    xhttp.send(params);
    xhttp.onreadystatechange = function() {
        if(xhttp.readyState == 4 && http.status == 200) {
            console.log("new map location added" + xhttp.responseText);
        }
    }
}

function getMatches(user, location, destination) {
    var xhttp = new XMLHttpRequest();
    var url =  'http://localhost:9200/rides/route/_search';
    var params = '{"sort" :' +
                    '[{"_geo_distance": ' +
                        '{"start":"'+location+'", ' +
                        '"order":"asc",' +
                        '"unit":"km"}}' +
                    ',{"_geo_distance":' +
                        '{"destination":"'+destination+'", ' +
                        '"order":"asc","unit":"km"}}],' +
                    '"query": { "match_all" :{}}, ' +
                    '"filter" :' +
                        '{ "geo_distance":' +
                            '{ "distance": "1km",' +
                            ' "start" :"' +location+'",' +
                            ' "destination": "'+destination+'"}},' +
                    '"from" : 0, "size" : 3}' ;

    xhttp.open("POST", url, false);
    xhttp.setRequestHeader("Content-type", "application/json");
    console.log("parms"+params);
    xhttp.send(params);
    if(xhttp.readyState == 4 && xhttp.status == 200) {
        response =  xhttp.responseText;
    }
    console.log("response is " + response);
    if (typeof response === 'undefined'){
        console.log('returned undefined from ES search') ;
        return;

    }
    hits = JSON.parse(response).hits.hits;
    if (hits.indexOf(0) > -1 && hits[0]._id != user) {
        hit = hits[0];
    }else{
        if (hits.length > 1){
            hit = hits[1] ;
        }else{
            console.log('did not find a second match');
            return;
        }
    }
    return {"user":hit._id,"start":hit._source.start,"destination":hit._source.destination };
}

http.createServer(function (req, res) {
    var user = quickDirtyUser(req);
    console.log(req.url);
    if (req.method == 'POST') {
        var body = '';
        req.on('data', function (data) {
            body += data;
            if (body.length > 1e6) {
                req.connection.destroy();
            }
        });
        req.on('end', function () {
            if (req.url == "/set"){
                var POST = JSON.parse(body);
                setTrip(user, POST.location, POST.destination);
                res.writeHead(200, {'Set-Cookie': 'user='+user, 'Content-Type': 'text/plain'});
                res.end('ok');
            }else{
                var POST = JSON.parse(body);
                matches = getMatches(user, POST.location, POST.destination);
                console.log(JSON.stringify(matches));
                res.writeHead(200, {'Set-Cookie': 'user='+user, 'Content-Type': 'text/json'});
                if (typeof matches !== 'undefined'){
                    res.end(JSON.stringify(matches));
                }
            }

        });
    }else{
        res.writeHead(200, {'Set-Cookie': 'user='+user, 'Content-Type': 'text/html'});
        var fileStream = fs.createReadStream('mappy.html');
        fileStream.pipe(res);
    }
}).listen(1337);
console.log('Server running MAPPY');
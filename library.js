(function(module, realModule) {

	"use strict";

	var fs = require("fs"),
			async = require('async'),
	    path = require("path"),
			ts3sq = require("node-teamspeak");

	module.renderTSwidget = function(widget, callback) {

		var serverInfo = {
			address: widget.data.address,
			username: widget.data.username,
			password: widget.data.password,
			name: widget.data.name,
			sqaddress: widget.data.sqaddress,
			sqport: widget.data.sqport,
			sid: widget.data.sid || 1
		};

		var tsw = new ts3sq(serverInfo.sqaddress, serverInfo.sqport);

    tsw.on("error", function(err){ console.error(err); });
    tsw.on("connect", function(res){
      tsw.send("login", { client_login_name: serverInfo.username, client_login_password: serverInfo.password }, function(err, res){
        if(err) { console.error(err); }
         tsw.send("use", { sid:serverInfo.sid }, function(err, res){
          if(err) { console.error(err); }

					function HTMLresponse(obj, clients){
			      //console.log(JSON.stringify(obj));
			      console.log(JSON.stringify(clients));

			      var online_clients = [];

			      for(var z=0; z<clients.length; z++){
			        if(!clients[z].client_type && !clients[z].client_away){
			          online_clients.push(clients[z]);
			        }
			      }

			      var pre = ""+fs.readFileSync("./public/templates/ts3.tpl");
			      var rep = {
			        "ts3-online-clients": online_clients.length,
			        "ts3-server-name": serverInfo.name || "Teamspeak Server",
			        "ts3-address" : serverInfo.address,
			        "ts3-tree": cycle(obj),
			      };

						if(!widget.data.showtree){
							rep["ts3-tree"] = "<!-- tree hidden -->";
						}
						var x;
			      for(x in rep){
							if(rep.hasOwnProperty(x)){
			        	pre = pre.replace(new RegExp("{{"+x+"}}", "g"), rep[x]);
							}
			      }

			      function cycle(o){
			        var html = "";
			        var x;
							for(x in o){
								if(obj.hasOwnProperty(x)){
									html += "<div class='channel";
									var spacerI = o[x].channel_name.match(/\[[lrcLRC]*spacer[0-9]*\]/);
									//console.log(spacerI);
									o[x].channel_name = o[x].channel_name.replace(/\[[lrcLRC]*spacer[0-9]*\]/, '');
									if(spacerI){
										html += " "+spacerI[0].replace('[', '').replace(']','');
										switch(o[x].channel_name){
											case "___":
												html += " solidline";
												break;
											case "---":
												html += " dashline";
												break;
											case "...":
												html += " dotline";
												break;
											case "-.-":
												html += " dashdotline";
												break;
											case "-..":
												html += " dashdotdotline";
												break;
										}
									}
									html += "'><div class='channel_name'>"+o[x].channel_name+"</div>";
									if(o[x].users){
										for(var i=0; i< o[x].users.length; i++){
											var client = o[x].users[i];
											if(!client.client_type){
												html += "<div class='client";
												var a = (""+client.client_servergroups).split(',');
												for(var c =0; c<a.length; c++){
													html += " servergroup"+a[c];
												}
												if(client.client_away) {
													html += " away";
												}
												if(client.client_input_muted){
													html += " inputmuted";
												}
												if(client.client_output_muted) {
													html += " outputmuted";
												}
												html+= "' >"+o[x].users[i].client_nickname+"</div>";
											}
										}
									}
									if(o[x].subChannels){
										html += cycle(o[x].subChannels);
									}

									html += "</div>";
								}

			        }

			        return html;
			      }

						callback(null, pre);

			    }

			    function getChannelsAndClients(callback){
			      tsw.send("clientlist", function(err, clients){
			        if(err) {console.error(err);}
			        //console.log(clients);
			        tsw.send("channellist", function(err, channels){
			          if(err) {console.error(err);}
			          //console.log(util.inspect(channels));
			          var cascade = [];
			          function find(arr, cid){
			            for(var x=0; x < arr.length; x++){

			              if(arr[x].cid === cid){
			                return arr[x];
			              } else if(arr[x].subChannels) {
			                var out = find(arr[x].subChannels, cid);
			                if(out) {return out;}
			              }
			            }
			          }
			          //console.log(channels);
			          for(var i=0; i<channels.length; i++){
			            var it = find(cascade, channels[i].pid);
			            if(it){
			              if(!it.subChannels) {it.subChannels = [];}
			              it.subChannels.push(channels[i]);
			            } else {
			              cascade.push(channels[i]);
			            }
			          }

			          if(!clients.length) {clients = [clients];}

			          //console.log(clients[0]);
			          //console.log(clients);
			          //console.log(clients.length);

			          var clientsinfo = [];
			          var len = clients.length;

								async.map(clients, function(client, cb){

			            tsw.send("clientinfo", { clid: client.clid }, function (err, clientinfo){

			              if(err) {console.error(err);}

			              clientsinfo.push(clientinfo);
			              var it = find(cascade, client.cid);
			              if(it){
			                if(!it.users) {it.users = [];}
			                it.users.push(clientinfo);
			              }

										cb(null, clientinfo);

			            });
			          }, function(err, results){
									tsw.send("quit");
			            if(callback) {callback(cascade, clientsinfo);}
								});
			        });
			      });
			    }

					getChannelsAndClients(HTMLresponse);

				});
			});
		});
	};

	module.defineWidget = function(widgets, callback) {
		widgets.push({
			widget: "teamspeak",
			name: "Teamspeak viewer",
			description: "Any text, html, or embedded script.",
			content: fs.readFileSync(path.resolve(__dirname, './public/templates/widget.tpl')),
		});

		callback(null, widgets);
	};

}(module.exports, module));

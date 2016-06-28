var express = require('express.io'),
    app = express(),
    http = require("http"),
    request = require("request"),
    ejs = require('ejs'),
    http = require('http'),
    server = http.createServer(app),
    io = require('socket.io').listen(server);

app.http().io();
io.set('log level', 0);

var bodyParser = require('body-parser'),
    getmac = require('getmac'),
    crypto = require('crypto'),
    deposit = require('./deposit.js'),
    //set this **************
    siteUrl = 'http://127.0.0.1:8001/';




function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isFloat(value) {
    if ((undefined === value) || (null === value)) {
        return false;
    }
    if (typeof value == 'number') {
        return true;
    }
    return !isNaN(value - 0);
}
function getIp(req) {
      return (req.headers['x-forwarded-for'] || '').split(',')[0]  || req.connection.remoteAddress;
};

function roll(key, text) {

    var hash = crypto.createHmac('sha512', key).update(text).digest('hex');
    var index = 0;
    var lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16);
    while (lucky >= Math.pow(10, 6)) {
        index++;
        lucky = parseInt(hash.substring(index * 5, index * 5 + 5), 16);
        if (index * 5 + 5 > 128) {
            lucky = 99.99;
            break;
        }
    }
    lucky %= Math.pow(10, 4);
    lucky /= Math.pow(10, 2);
    return lucky;
}


var bitcoin = require('bitcoin');

client = new bitcoin.Client({
  host: 'rpc.blockchain.info',
  port: 80,
  user: '4f89815c-1a3d-4b90-afab-fc0d4e5031ab',
  pass:'Ozergul.9!',
  timeout: 30000
});

//client.cmd('listtransactions', '*', 10, function(err, data) {console.log(data);})



/* mysql */
var mysql      = require('mysql');
    connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'ozergul9',
    database : 'dice'
});
connection.connect();

/* tema motoru */
app.set('view engine', 'html');
app.engine('html', ejs.__express);
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

/* session */

app.use(express.cookieParser())
app.use(express.session({secret: 'monkey'}))

/* json parser */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

require('./admin.js')(app, io, request, siteUrl);



/*======================================
play
=======================================*/
app.get('/play', function(req, res) {

  if(req.session.user_id != undefined) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ?', [user_id],  function(err, user) {
        res.render('play.ejs', {baslik: "Play", user: user[0]});
    });
  } else {
      res.render('index.ejs', {baslik: "Please login"});
  }
});
/*======================================
index
=======================================*/
app.get('/', function(req, res) {
  console.log(req.session);
  res.render('index.ejs', {baslik: "Index"});
});
/*======================================
logout
=======================================*/
app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect("/");
});

/*======================================
user info
=======================================*/
app.get('/api/info/:user_id', function(req, res) {
  if(isFloat(req.params.user_id)) {

    var user_id = req.params.user_id;
    connection.query('SELECT user_balance, user_profit, user_bet_count, user_win_count, user_wagered FROM users WHERE user_id = ?', [user_id],  function(err, user) {

      res.send(user);

    })
  } else {
    res.send({err: "Please write user_id"});
  }
});
    

/*======================================
site info
=======================================*/
app.get('/api/info', function(req, res) {
  connection.query('SELECT * FROM metas',  function(err, metas) { // site stats

    getMetaByKey("all_bets", function(all_bets) {
      getMetaByKey("all_profit", function(all_profit) {
        getMetaByKey("all_wins", function(all_wins) {
          getMetaByKey("all_loses", function(all_loses) {
            getMetaByKey("all_wagered", function(all_wagered) {
              connection.query('SELECT SUM(invest_amount) AS total_amount, SUM(invest_profit) AS total_profit FROM invests WHERE divest = 0',  function(err, total_invest) { 
                var all_stats = {
                  all_bets: all_bets,
                  all_profit: all_profit,
                  all_wins: all_wins,
                  all_loses: all_loses,
                  all_wagered: all_wagered,
                  site_total_invest_amount: total_invest[0].total_amount,
                  site_total_invest_profit: total_invest[0].total_profit
                };
                res.send(all_stats);
              })  
            })  
          })   
        }) 
      })   
    })
     
  })
});

function getMetaByKey(key, cb) {
  connection.query('SELECT * FROM metas WHERE meta_key = ?', [key],  function(err, metas) {
    cb(metas[0].meta_value)
  })
}


/*======================================
all bets
=======================================*/
app.get('/api/bets/:c', function(req, res) {
  var c = req.params.c;
  if(c == "my") {
    var user_id = req.session.user_id;
    connection.query('SELECT * FROM bets WHERE bet_user_id = ? ORDER BY bet_id DESC LIMIT 50', [user_id],  function(err, bets) {
       res.send(bets); 
    });
  } else if(isFloat(c)){
    connection.query('SELECT bets.*, users.user_name FROM bets INNER JOIN users ON bets.bet_user_id = users.user_id ORDER BY bet_id DESC LIMIT ' +c, function(err, bets) { 
      res.send(bets); 
    });
  } else {
    res.send("What are you looking for?");  
  }

});


/*======================================
all my invests
=======================================*/
app.get('/api/invests/my', function(req, res) {
  
  if(req.session.user_id != undefined) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM invests WHERE invest_user_id = ? AND divest = 0', [user_id], function(err, my_invests) { 
      var my_total_invest_amount = 0,
          my_total_invest_profit = 0;

      
        for (var i = 0; i < my_invests.length; i++) {
          var my_total_invest_amount = parseFloat(my_total_invest_amount) + parseFloat(my_invests[i].invest_amount),
              my_total_invest_profit = parseFloat(my_total_invest_profit) + parseFloat(my_invests[i].invest_profit)
        };

        var invest_stats = {
          my_total_invest_amount: my_total_invest_amount,
          my_total_invest_profit: my_total_invest_profit
        }
        var data = {
          invest_stats: invest_stats,
          my_invests: my_invests
        };
      res.send(data); 

    });
  } else {
    res.send({err: "Please login"}); 
  }
});


/*======================================
my withdraws
=======================================*/
app.get('/api/withdraws/my', function(req, res) {
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT withdraws.*, users.user_name FROM withdraws INNER JOIN users ON withdraws.wd_user_id = users.user_id WHERE users.user_id = ? ORDER BY withdraws.wd_id DESC', [user_id], function(err, withdraws) { 
      res.send(withdraws); 
    });
  } else {
    res.send({err: "Please login"}); 
  }
});

/*======================================
my deposits
=======================================*/
app.get('/api/deposits/my', function(req, res) {
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT deposits.* FROM deposits INNER JOIN users ON deposits.dp_btc_address = users.user_btc_address WHERE users.user_id = ? ORDER BY deposits.dp_id DESC', [user_id], function(err, chat) { 
      res.send(chat); 
    });
  } else {
    res.send({err: "Please login"}); 
  }
});

/*======================================
chat
=======================================*/
app.get('/api/chat/page/:c', function(req, res) {
  var count = req.params.c,
      per_page = 10,
      limit = (count - 1) * per_page;
  if(isFloat(count)) {
    connection.query('SELECT chat.*, users.user_name, users.user_level FROM chat INNER JOIN users ON chat.m_user_id = users.user_id ORDER BY chat.m_id DESC LIMIT ?, ?', [limit, per_page], function(err, messages) { 
      console.log(err);
      res.send(messages); 
    });
  } else {
    res.send({err: "Please write number"})
  }
});
app.get('/api/chat/total', function(req, res) {
  connection.query('SELECT COUNT(m_id) AS total FROM chat', function(err, all_chat) {
    res.send(all_chat[0]);
  });
})

/*======================================
invest
=======================================*/
app.io.route('invest:do', function(req) {
  var invest_amount = Math.abs(req.data.invest_amount);

  if(req.session.user_id) {

    var user_id = req.session.user_id;
      if(invest_amount >= 0.0001) {
        connection.query('SELECT user_balance FROM users WHERE user_id = ?', [user_id],  function(err, balance) {

          if(balance[0].user_balance > invest_amount) {
            connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) - ? WHERE user_id = ?', [invest_amount, user_id], function(err, res) {})

            connection.query('SELECT SUM(invest_amount) AS total FROM invests WHERE divest = 0',  function(err, invests) { 
              var total = invests[0].total;
              var invest = {
                invest_user_id :user_id,
                invest_amount :invest_amount,
                invest_date: new Date().getTime(),
                invest_profit: 0,
                divest: 0
              }
              connection.query('INSERT INTO invests SET ?', invest, function(err, result) {
                req.io.respond({
                  c: 1,
                  m: "Successful invest"
                })
                updateMyInvests(req);
                updateSiteInfo();
              });
            });
          } else {
            req.io.respond({
              c: 0,
              m: "balance not enough to invest"
            })
            console.log("balance not enough to invest");
          }
       });
      } else {
        req.io.respond({
          c: 0,
          m: "min invest amount 0.0001 btc"
        }) 
        console.log("min invest amount 0.0001 btc");
      }
    } else {
      req.io.respond({
        c: 0,
        m: "Please login"
      })   
    }
});
/*======================================
divest
=======================================*/
app.io.route('invest:divest', function(req) {
  var invest_id = req.data.invest_id;
  
  if(req.session.user_id) {
    var user_id = req.session.user_id;
    connection.query('SELECT * FROM invests WHERE invest_id = ? AND invest_user_id = ?', [invest_id, user_id], function(err, invest) { 
      connection.query('SELECT user_balance FROM users WHERE user_id = ?', [user_id],  function(err, balance) {
        var last = parseFloat(invest[0].invest_amount) + parseFloat(invest[0].invest_profit);
        var mutlakLast = Math.abs(last);

        /* site profit = 10% */
        last = last*0.9;

          connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) + ? WHERE user_id = ?', [last, user_id], function(err, res) {})  
          connection.query('UPDATE invests SET divest = 1 WHERE invest_id = ? AND invest_user_id = ?', [invest_id, user_id], function(err, res) {});
          req.io.respond({
            c: 1,
            m: "You divested successfully"
          })  
          updateMyInvests(req);
          updateSiteInfo();
      });
    });
  } else {
     req.io.respond({
      c: 0,
      m: "Please login"
    }) 
  }
});


/*======================================
investBet
=======================================*/
function investBet(bet_amount, profit, bet_result) {
   connection.query('SELECT SUM(invest_amount) AS total FROM invests WHERE divest = 0',  function(err, total_invest) { 
    var total = total_invest[0].total;
     connection.query('SELECT * FROM invests WHERE divest = 0',  function(err, all_invests) { 
      
        for (var i = 0; i < all_invests.length; i++) {
          var percent = total/all_invests[i].invest_amount,
              last = 100/percent,
              bet_last = bet_amount/percent;
              profit_last = profit/percent;
          if(bet_result == "win") {
            connection.query('UPDATE invests SET invest_profit = (@cur_value := invest_profit) - ? WHERE invest_id = ?', [profit_last, all_invests[i].invest_id], function(err, res) {})
          }  else if(bet_result == "lose") {
            connection.query('UPDATE invests SET invest_profit = (@cur_value := invest_profit) + ? WHERE invest_id = ?', [bet_last, all_invests[i].invest_id], function(err, res) {})
          }    
        };
     });  
  }); 
}

/*======================================
login
=======================================*/
app.io.route('user:login', function(req) {
  var user_name = req.data.user_name,
      user_password =  crypto.createHmac('sha512', req.data.user_password+"").digest('hex');

  connection.query('SELECT * FROM users WHERE user_name = ?', [user_name],  function(err, user) {

  if(user[0]) {
    if(user[0].user_password == user_password) {
      req.io.respond({
        c: 1,
        m: "Success login"
      })
      req.session.user_id = user[0].user_id;
      req.session.save(function() {
        console.log("session saved");
      })

    } else {
      req.io.respond({
        c: 0,
        m: "Password is wrong"
      }) 
    }
  } else {
    req.io.respond({
      c: 0,
      m: "User not found"
    }) 
  }


  });
  
});



/*======================================
register
get last user_id and add + 1 to reg user.
=======================================*/
app.io.route('user:register', function(req) {
  var user_name = req.data.user_name,
      user_password =  crypto.createHmac('sha512', req.data.user_password+"").digest('hex');
  if(user_name) {
    if(user_password) {
      connection.query('SELECT * FROM users WHERE user_name = ?', [user_name],  function(err, user) {

        if(user[0]) {
          req.io.respond({
            c: 0,
            m: "This user name is already used"
          }) 
        } else {          
          var new_user = {
              user_date: new Date().getTime(),
              user_name: user_name,
              user_password: user_password,

              user_balance: 0,
              user_bet_count: 0,
              user_win_count: 0,
              user_profit: 0,
              user_wagered: 0,

              user_level: 0,
              user_hash: getRandomInt(1, 1000000) + ""+ getRandomInt(1, 1000000) +""+ getRandomInt(1, 1000000),
              user_last_hash: "Not yet"
          }
          connection.query('INSERT INTO users SET ?', new_user, function(err, result) {
            console.log(err);
            var user_id = result.insertId;
            if(!user_id) {

              req.io.respond({
                c: 0,
                m: "User could not be saved"
              }) 
            } else {
              client.cmd('getnewaddress', user_id + "", function(err, btc_address, he) {
                console.log(err, btc_address);
                if(err) {
                  req.io.respond({
                    c: 0,
                    m: "Bitcoin client has some problem now. Please try again later"
                  }) 
                  connection.query('DELETE FROM users WHERE user_id = ?', [user_id], function(err, result) {

                  });
                } else {
                  connection.query('UPDATE users SET user_btc_address = ? WHERE user_id = ?', [btc_address, user_id], function(err, result) {

                  });
                  req.session.user_id = user_id;
                  req.session.save(function() {
                    console.log("session saved");
                  }) 
                  req.io.respond({
                    c: 1,
                    m: "Successful registering"
                  })
                }
              });
            }
          });

        }
      });
    } else {
      req.io.respond({
        c: 0,
        m: "Password required"
      })    
    }
  } else {
      req.io.respond({
        c: 0,
        m: "User name required"
      })     
  }
});
/*======================================
change username
=======================================*/
app.io.route('change:username', function(req) {
  var new_user_name = req.data.new_user_name,
      new_user_name = connection.escape(new_user_name);


  if(req.session.user_id) {
    var user_id = req.session.user_id;

    if(new_user_name) {
      new_user_name = new_user_name.replace(/[^a-z0-9]/gi,'');
      connection.query('SELECT * FROM users WHERE user_name = ?', [new_user_name],  function(err, users) { 
        if(users[0]) {
          req.io.respond({
            c: 0,
            m: "This name is now using by other user, please write another one"
          }) 
        } else {
          connection.query('UPDATE users SET user_name = ? WHERE user_id = ?', [new_user_name, user_id], function(err, result) {
              req.io.respond({
                c: 1,
                m: "Edited successfully"
              }) 
          })
        }
      });    
    } else {
     req.io.respond({
        c: 0,
        m: "Write something"
      }) 
    } 
  } else {
   req.io.respond({
      c: 0,
      m: "Please login"
    }) 
  }
});
/*======================================
ajax change password
=======================================*/
app.io.route('change:password', function(req) {
  var current_password = crypto.createHmac('sha512', req.data.current_password).digest('hex'),
      new_password = crypto.createHmac('sha512', req.data.new_password).digest('hex'),
      user_id = req.session.user_id;
  if(new_password) {
    connection.query('SELECT user_password FROM users WHERE user_id = ? AND user_password = ?', [user_id, current_password], function(err, passquery) {
      if(passquery[0]) {
        connection.query('UPDATE users SET user_password = ? WHERE user_id = ?', [new_password, user_id], function(err, updatequery) {
            req.io.respond({
              c: 1,
              m: "Password edited successfully"
            }) 
        })
      } else {
        req.io.respond({
            c: 0,
            m: "Current password is wrong"
          })         
      }

    })
  } else {
   req.io.respond({
      c: 0,
      m: "Write something"
    }) 
  } 
});


/*======================================
withdraw
=======================================*/
app.io.route('withdraw', function(req) {
  var bitcoin_address = req.data.bitcoin_address,
      amount = Math.abs(req.data.amount);

  if(req.session.user_id) {
    var user_id = req.session.user_id;

    if(amount) {
      client.cmd("validateaddress", bitcoin_address, function(err, control) {
        if(control.isvalid) {
          if(isFloat(amount)) {
            if(amount > 0.000009) {
              connection.query('SELECT user_balance FROM users WHERE user_id = ?', [user_id],  function(err, user_balance) { 
                if(user_balance[0]) {
                  if(user_balance[0].user_balance > 0) {
                    if(Math.abs(user_balance[0].user_balance) >= amount) {
                        var wd = {
                          wd_date: new Date().getTime(),
                          wd_user_id: user_id,
                          wd_amount: amount,
                          wd_btc_address: bitcoin_address,
                          wd_confirm: false,
                          wd_tx_id: 0
                        }
                        connection.query('INSERT INTO withdraws SET ?', wd, function(err, result) {

                          if(err) {
                            console.log(err);
                          } else {
                            connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) - ? WHERE user_id = ?', [amount, user_id], function(err, res) {})

                            req.io.respond({
                              c: 1,
                              m: "Successful withdraw request"
                            })     
                            updateMyInvests(req)              
                          }
                        });             
                    } else {
                      console.log("Balance not enough");
                      req.io.respond({
                        c: 0,
                        m: "Balance not enough"
                      }) 
                    }
                  } else {
                    console.log("Your current balance is 0");
                    req.io.respond({
                      c: 0,
                      m: "Your current balance is 0"
                    })    
                  }
                } else {
                  console.log("Your balance is not found");
                  req.io.respond({
                    c: 0,
                    m: "Your balance is not found"
                  }) 
                }
              });
            } else {
              console.log("So low amount");
              req.io.respond({
                c: 0,
                m: "So low amount"
              })       
            }
          } else {
            console.log("Please write number");
            req.io.respond({
              c: 0,
              m: "Please write number"
            })  
          }
        } else {
          console.log("Write valid address");
          req.io.respond({
            c: 0,
            m: "Write valid address"
          }) 
        }
      })
    } else {
      console.log("Write something");
      req.io.respond({
        c: 0,
        m: "Write something"
      }) 
    }
  } else {
      console.log("login");
      req.io.respond({
        c: 0,
        m: "Please login"
      })  
  }
});

/*======================================
socket
=======================================*/
app.io.route('bet:do', function(req) {
    var data = req.data,
        socket = req.socket,
        bet_amount = data.bet_amount,
        payout = data.payout,
        //chance = data.chance,
        //profit = data.profit,
        type = data.type,
        chance = (1 / (payout / 100) * ((100 - 1) / 100)),
        profit = ( ( bet_amount * payout ) - bet_amount);


    if(req.session.user_id != undefined) {
      var user_id = req.session.user_id;
      connection.query('SELECT * FROM users WHERE user_id = ?', [user_id],  function(err, user) { // sessiondaki user_id ye göre çek
        if(user[0]) {
          if(user[0].user_balance > 0) {
            if(isFloat(bet_amount) && isFloat(payout) && isFloat(chance) && isFloat(profit)) {

              if(Math.abs(user[0].user_balance) > bet_amount || Math.abs(user[0].user_balance) == bet_amount) {
                connection.query('SELECT SUM(invest_amount) AS total_amount, SUM(invest_profit) AS total_profit FROM invests WHERE divest = 0',  function(err, total_invest) { 
                var site_total_invest_amount = total_invest[0].total_amount,
                    site_total_invest_profit = total_invest[0].total_profit,
                    bankroll = site_total_invest_amount + site_total_invest_profit; 

                    if(bet_amount < bankroll/10) {
                     doBet(socket, req, bet_amount, payout, chance, profit, type, user[0].user_id, user[0].user_hash, user[0].user_bet_count, user[0].user_name);
                     req.io.respond({
                        c: 1,
                        m: "Success bet"
                     }) 
                    } else {
                     req.io.respond({
                        c: 0,
                        m: "Your bet cant be high than bankroll"
                     }) 
                    }
                });
              } else {
                 req.io.respond({
                    c: 0,
                    m: "balance not enough"
                  }) 
                console.log(user[0].user_balance, bet_amount, "balance not enough");
              }
            } else {
               req.io.respond({
                  c: 0,
                  m: "sure you write only number"
              }) 
              console.log("sure you write only number");  
            }
          } else {
          req.io.respond({
              c: 0,
              m: "Your balance is 0"
          }) 
          console.log("Your balance is 0");            
          }
        } else {
          req.io.respond({
              c: 0,
              m: "user not found"
          }) 
          console.log("user not found");
        }
      }); // <-- users query
    } else {
      console.log("please login");
      req.io.respond({
          c: 0,
          m: "Please login"
      }) 
    }
});
/*======================================
randomize
=======================================*/
app.io.route('bet:randomize', function(req) {
  var user_id = req.session.user_id,
      hash = getRandomInt(1,1000000)*1548597;
  connection.query('SELECT * FROM users WHERE user_id = ?', [user_id], function(err, user) { 
    connection.query('UPDATE users SET user_last_hash = ? WHERE user_id = ?', [user[0].user_hash, user_id], function(err, res1) {
      //connection.query('UPDATE users SET user_bet_count = ? WHERE user_id = ?', [1, user_id], function(err, res1) { })
      connection.query('UPDATE users SET user_hash = ? WHERE user_id = ?', [hash, user_id], function(err, res2) {
        if(!err) {
          req.io.respond({
              c: 1,
              m: 'Hash updated',
              hash: hash
          })
        } else {
          req.io.respond({
              c: 0,
              m: "Error while inserting new has"
          })          
        }

      })
    })
  });
});
/*======================================
chat:send
=======================================*/
app.io.route('chat:send', function(req) {
  var message_text = req.data.message_text,
      user_id = req.session.user_id;
  if(req.session.user_id != undefined) {
    if(message_text) {
      connection.query('SELECT * FROM users WHERE user_id = ?', [user_id], function(errUser, user) { 
        var message = {
          m_date: new Date().getTime(),
          m_user_id: user_id,
          m_text: message_text
        }
        if(!errUser) {
          connection.query('INSERT INTO chat SET ?', message, function(errInsert, result) {
            if(!errInsert) {
              message.user_name = user[0].user_name;

              req.io.respond({
                  c: 1,
                  m: "Sent",
                  message : message
              });
              
              req.io.broadcast('chat:get', message);
            } else {
              req.io.respond({
                  c: 0,
                  m: "Error, message could not save."
              })     
            }
          });
        } else {
          req.io.respond({
              c: 0,
              m: "Error, message could not save. user_name cant be got"
          })      
        }


      });
    } else {
      req.io.respond({
          c: 0,
          m: "Please write message"
      }) 
    }

  } else {
    req.io.respond({
        c: 0,
        m: "Please login"
    })      
  }
});
/*======================================
bet
=======================================*/
function doBet(socket, req, bet_amount, payout, chance, profit, type, user_id, user_hash, user_bet_count, user_name) {
  rolledNumber = roll(user_hash, user_bet_count);

  if(type == "under") {
     if (rolledNumber < chance) {
      saveBet(socket, req, bet_amount, payout, chance, profit, rolledNumber, type, user_id, user_bet_count, "win", user_name);

      /* win */
     } else {
      saveBet(socket, req, bet_amount, payout, chance, profit, rolledNumber, type, user_id, user_bet_count, "lose", user_name);
      
      /* lose */
     }
  } else if(type == "over") {
     if (rolledNumber > 100 - chance) { // rolledNumber > 100 - chance
      chance = 100 - chance;
      saveBet(socket, req, bet_amount, payout, chance, profit, rolledNumber, type, user_id, user_bet_count, "win", user_name);
      
      /* win */
     } else {
      chance = 100 - chance;
      saveBet(socket, req, bet_amount, payout, chance, profit, rolledNumber, type, user_id, user_bet_count, "lose", user_name);
      
      /* lose */
     }
  }
}

function saveBet(socket, req, bet_amount, payout, chance, profit, rolledNumber, type, user_id, user_bet_count, bet_result, user_name) {
  connection.query('UPDATE users SET user_bet_count = (@cur_value := user_bet_count) + 1 WHERE user_id = ?', [user_id], function(err, res) {
    if(bet_result == "win") {
      last_profit = profit;
    } else {
      last_profit = -bet_amount;
    }
    var bet = {
      bet_user_id: user_id,
      bet_date: new Date().getTime(),
      bet_amount: bet_amount,
      bet_payout: payout,
      bet_chance: chance,
      bet_profit: last_profit,
      bet_roll: rolledNumber,
      bet_type: type,
      bet_result: bet_result
    }
    connection.query('INSERT INTO bets SET ?', bet, function(err, result) {
      if(result.insertId) {
        /* stats */
        connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) + 1 WHERE meta_key = "all_bets"', function(err, res) {
          connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) + ? WHERE meta_key = "all_wagered"', [bet_amount], function(err, res) {
            connection.query('UPDATE users SET user_wagered = (@cur_value := user_wagered) + ? WHERE user_id = ?', [bet_amount, user_id], function(err, res) {
              connection.query('UPDATE users SET user_profit = (@cur_value := user_profit) + ? WHERE user_id = ?', [last_profit, user_id], function(err, res) {
                if(bet_result == "win") {
                  investBet(bet_amount, profit, "win");
                  /* stats */
                  connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) + ? WHERE meta_key = "all_profit"', [profit], function(err, res) {
                    connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) + 1 WHERE meta_key = "all_wins"', function(err, res) {
                      /* bets */
                      connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) + ? WHERE user_id = ?', [profit, user_id], function(err, res) {
                        connection.query('UPDATE users SET user_win_count = (@cur_value := user_win_count) + 1 WHERE user_id = ?', [user_id], function(err, res) {
                          bet.bet_id = result.insertId;
                          bet.user_name = user_name;

                          req.io.emit('update:my:bet', bet);
                          app.io.broadcast('update:site:bet', bet);

                          updateMyInvests(req);
                          updateSiteInfo();
                        })
                      })
                    })
                  })
                } else {
                  investBet(bet_amount, profit, "lose");
                  /* stats */
                  connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) - ? WHERE meta_key = "all_profit"', [profit], function(err, res) {
                    connection.query('UPDATE metas SET meta_value = (@cur_value := meta_value) + 1 WHERE meta_key = "all_loses"', function(err, res) {
                      /* bets */
                      connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) - ? WHERE user_id = ?', [bet_amount, user_id], function(err, res) {
                        bet.bet_id = result.insertId;
                        bet.user_name = user_name;

                        req.io.emit('update:my:bet', bet);
                        app.io.broadcast('update:site:bet', bet);

                        updateMyInvests(req);
                        updateSiteInfo();
                      })
                    })
                  })
                }
              })
            })
          })
        })
      } else {
        console.log("could not be inserted bet");
      }
    });
  });
}

function updateMyInvests(req) {
  if(req.session.user_id != undefined) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM invests WHERE invest_user_id = ? AND divest = 0', [user_id], function(err, my_invests) { 
      var my_total_invest_amount = 0,
          my_total_invest_profit = 0;
        for (var i = 0; i < my_invests.length; i++) {
          var my_total_invest_amount = parseFloat(my_total_invest_amount) + parseFloat(my_invests[i].invest_amount),
              my_total_invest_profit = parseFloat(my_total_invest_profit) + parseFloat(my_invests[i].invest_profit)
        };

        var invest_stats = {
          my_total_invest_amount: my_total_invest_amount,
          my_total_invest_profit: my_total_invest_profit
        }
        var data = {
          invest_stats: invest_stats,
          my_invests: my_invests
        };
      req.io.emit('update:my:invests', data);
    });
  }
}

function updateSiteInfo() {
  request({ url: siteUrl + 'api/info', method: 'GET', json: true}, function (error, response, info) {
    if (!error && response.statusCode == 200) {
      app.io.broadcast('update:site:info', info);
      
    } else {
      console.log(error);
    }
  }) /* <--- api/info */
}

app.locals.site_adres = siteUrl;



app.listen(8001)

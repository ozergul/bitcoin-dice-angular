module.exports = function(app, socket, request, siteUrl) {
  /*======================================
  admin
  =======================================*/
  app.get('/admin', function(req, res) {

    if(req.session.user_id) {
      var user_id = req.session.user_id;
      var user_id = 2

      connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
        if(user[0]) {
          request({ url: siteUrl + 'api/info', method: 'GET', json: true}, function (error, response, info) {
            if (!error && response.statusCode == 200) {
              var x = "yapılıyor";

              var dashboard = {
                bets: info.all_bets,
                wins: info.all_wins,
                wagered: info.all_wagered,
                profit: info.all_profit,
                invests: info.site_total_invest_amount,
                invests_profits: info.site_total_invest_profit,
              }
              connection.query('SELECT COUNT(DISTINCT(invest_user_id)) AS investors FROM invests',  function(err, invests) {
                dashboard.investors = invests[0].investors;
                connection.query('SELECT COUNT(user_id) AS users_count FROM users',  function(err, users) {
                  dashboard.users_count = users[0].users_count;
                  connection.query('SELECT COUNT(wd_id) AS withdraws FROM withdraws WHERE wd_confirm = 0',  function(err, withdraws) {
                    dashboard.withdraws = withdraws[0].withdraws;
                    connection.query('SELECT COUNT(dp_id) AS deposits FROM deposits',  function(err, deposits) {
                      dashboard.deposits = deposits[0].deposits;  
                      res.render('admin.ejs', {baslik: "Admin", user: user[0], dashboard: dashboard});
                    });
                  });
                })
                
              });
            } else {
              console.log(error);
            }
          })
          
        } else {
          res.render('index.ejs', {baslik: "You cant access admin page"});
        }
        
      });
    } else {
      res.render('index.ejs', {baslik: "Please login"});
    }

  });
  /*======================================
  users pagination
  =======================================*/
  app.get('/api/users/:c', function(req, res) {
    var count = req.params.c,
        per_page = 100,
        limit = (count - 1) * per_page;
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT * FROM users ORDER BY user_id ASC LIMIT ?, ?', [limit, per_page], function(err, all_users) {
          res.send(all_users);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    res.render('index.ejs', {baslik: "Please login"});
  }
  })

  /*======================================
  wd pagination
  =======================================*/
  app.get('/api/withdraws/page/:c', function(req, res) {
    var count = req.params.c,
        per_page = 10,
        limit = (count - 1) * per_page;
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT withdraws.*, users.user_name FROM withdraws INNER JOIN users ON withdraws.wd_user_id = users.user_id ORDER BY wd_id DESC LIMIT ?, ?', [limit, per_page], function(err, all_withdraws) {
          res.send(all_withdraws);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    //res.render('index.ejs', {baslik: "Please login"});
  }
  })
  /*======================================
  get total wds
  =======================================*/
  app.get('/api/withdraws/total', function(req, res) {
  
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT COUNT(wd_id) AS total FROM withdraws', function(err, all_withdraws) {
          res.send(all_withdraws[0]);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    res.render('index.ejs', {baslik: "Please login"});
  }
  })


  /*======================================
  withdraw set
  =======================================*/
  app.io.route('withdraw:set', function(req) {
    var wd_id = req.data.wd_id,
        type =  req.data.type,
        btc_address = req.data.btc_address,
        amount = req.data.amount;
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    if(type == 'decline') {
      connection.query('UPDATE withdraws SET wd_confirm = ? WHERE wd_id = ?', [2, wd_id], function(err, result) {
        if(!err) {
          req.io.respond({
            c: 1,
            m: "Successfull decline"
          })
        } else {
          req.io.respond({
            c: 0,
            m: "Decline could not be happen"
          })
        }

      });
    } else if(type == 'approve') {
      client.cmd('sendtoaddress', btc_address, amount, function(errCmd, txid) {
        if(!errCmd) {
          console.log(txid);
          connection.query('UPDATE withdraws SET wd_confirm = ? WHERE wd_id = ?', [1, wd_id], function(err, result) {
            connection.query('UPDATE withdraws SET wd_tx_id = ? WHERE wd_id = ?', [txid, wd_id], function(err, result) {
              req.io.respond({
                c: 1,
                m: "Successfull approve"
              })
            })
          });
        } else {
          req.io.respond({
            c: 0,
            m: "error"
          })
        }

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
  dp pagination
  =======================================*/
  app.get('/api/deposits/page/:c', function(req, res) {
    var count = req.params.c,
        per_page = 10,
        limit = (count - 1) * per_page;
  if(req.session.user_id) {
    var user_id = req.session.user_id;


    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT deposits.*, users.user_name FROM deposits INNER JOIN users ON deposits.dp_btc_address = users.user_btc_address ORDER BY dp_id DESC LIMIT ?, ?', [limit, per_page], function(err, all_deposits) {
          res.send(all_deposits);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    res.render('index.ejs', {baslik: "Please login"});
  }
  })
  /*======================================
  get total dps
  =======================================*/
  app.get('/api/deposits/total', function(req, res) {
  
  if(req.session.user_id) {
    var user_id = req.session.user_id;


    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT COUNT(dp_id) AS total FROM deposits', function(err, all_withdraws) {
          res.send(all_withdraws[0]);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    res.render('index.ejs', {baslik: "Please login"});
  }
  })
  /*======================================
  chat:delete
  =======================================*/
  app.io.route('chat:delete', function(req) {
    var m_id = req.data.m_id;
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('DELETE FROM chat WHERE m_id = ? ', [m_id], function(err, res) {
          if(!err) {
            req.io.respond({
              c: 1,
              m: "Deleted"
            })
          } else {
            req.io.respond({
              c: 0,
              m: "Error while deleting message"
            })
          }
        });
      } else {
          req.io.respond({
            c: 0,
            m: "You must be admin"
          })
      }
     });
  } else {
    req.io.respond({
      c: 0,
      m: "Please login"
    })
  }   
  });


  /*======================================
  dp pagination
  =======================================
  app.get('/api/invests/page/:c', function(req, res) {
    var count = req.params.c,
        per_page = 10,
        limit = (count - 1) * per_page;
  if(req.session.user_id) {
    var user_id = req.session.user_id;

    connection.query('SELECT * FROM users WHERE user_id = ? AND user_level = 10', [user_id],  function(err, user) {
      if(user[0]) {
        connection.query('SELECT invests.*, users.user_name, users.user_balance FROM invests INNER JOIN users ON invests.invest_user_id = users.user_id ORDER BY invest_id DESC LIMIT ?, ?', [limit, per_page], function(err, all_deposits) {
          res.send(all_deposits);
        });
      } else {
        res.send({err: "You must be admin"});
      }
     });
  } else {
    res.render('index.ejs', {baslik: "Please login"});
  }
  })
  connection.query('SELECT invests.*, users.user_name, users.user_balance FROM invests INNER JOIN users ON invests.invest_user_id = users.user_id AND invests.divest = "0" ORDER BY invest_id DESC LIMIT ?, ?', [1, 10], function(err, all_deposits) {
    console.log(err, all_deposits);
  });*/
};


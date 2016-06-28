var cron = require('cron').CronJob,
	bitcoin = require("bitcoin");

client = new bitcoin.Client({
  host: 'rpc.blockchain.info',
  port: 80,
  user: '4f89815c-1a3d-4b90-afab-fc0d4e5031ab',
  pass:'Ozergul.9!',
  timeout: 30000
});

function DepositControl() {
	client.cmd('listtransactions', '*', 10, function(err, trans) {
		
		if(err) return;
		
		var depositsClient = trans.transactions;

		for (var i = 0; i < depositsClient.length; i++) {
			InsertOrUpdateDeposit(i)();
		};
		function InsertOrUpdateDeposit(i) {
			return function(){
				if(depositsClient[i].category == "receive"){
					if(depositsClient[i].amount > 0.00000001){
						connection.query('SELECT * FROM deposits WHERE dp_tx_id = ?', depositsClient[i].txid,  function(err, depositsQuery) {

							if(!depositsQuery[0]) {
								//insert
								
								var new_deposit = {
									dp_date: new Date().getTime(),
									dp_amount:  depositsClient[i].amount,
									dp_btc_address:  depositsClient[i].address,
									dp_confirmations:  depositsClient[i].confirmations,
									dp_tx_id:  depositsClient[i].txid
								}
								connection.query('INSERT INTO deposits SET ?', new_deposit, function(err, result) {
        					connection.query('UPDATE users SET user_balance = (@cur_value := user_balance) + ? WHERE user_btc_address = ?', [depositsClient[i].amount, depositsClient[i].address], function(err, res) {
        						console.log("txid inserted: " + depositsClient[i].txid);
        					})
								});
							} else {
								// update
		        				connection.query('UPDATE deposits SET dp_confirmations = ? WHERE dp_tx_id = ?', [depositsClient[i].confirmations, depositsClient[i].txid], function(err, updatequery) {
		        				});
							}
						});
					}
				}
			}
		}
	});
}


var job = new cron('* * * * * *', function() {
	DepositControl();
});
job.start();
function stream_withdraw(balance, amount_stream) {      
    return pair(balance,
                () => stream_withdraw(
                          balance - head(amount_stream),
                          stream_tail(amount_stream)));   
}

const my_amounts = list_to_stream(list(50, 100, 40));
const my_account_stream = stream_withdraw(200, my_amounts);	
eval_stream(my_account_stream, 3);
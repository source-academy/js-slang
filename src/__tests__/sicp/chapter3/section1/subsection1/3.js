let balance = 100;

function withdraw(amount) {
   if (balance >= amount) {
      balance = balance - amount;
      return balance;
   } else {
      return "Insufficient funds";
   }
}
withdraw(25); // output: 75
withdraw(25); // output: 50
withdraw(60); // output: "Insufficient funds"
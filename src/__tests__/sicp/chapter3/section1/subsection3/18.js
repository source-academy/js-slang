function factorial(n) {
   let product = 1;
   let counter = 1;
   function iter() {
      if (counter > n) {
          return product;
      } else {
          product = counter * product;
          counter = counter + 1;
          return iter();
      }
   }
   return iter();
}

factorial(5);
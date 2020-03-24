function factorial(n) {
   function iter(product,counter) {
      if (counter > n) {
          return product;
      } else {
          return iter(counter*product,
                       counter+1);
      }
   }
   return iter(1,1);
}

factorial(5);
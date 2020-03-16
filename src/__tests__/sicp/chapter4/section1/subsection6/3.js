(n => (fact => fact(fact, n))
      ( (ft, k) => k === 1
                   ? 1
                   : k * ft(ft, k - 1) 
      )
)
(10);
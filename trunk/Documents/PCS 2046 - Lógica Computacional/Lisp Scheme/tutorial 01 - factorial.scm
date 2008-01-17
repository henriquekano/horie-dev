;;; The FACT procedure computes the factorial
;;; of a nonnegative integer.
(define fact
  (lambda (n)
    (if (= n 0)
      1
      (* n (fact (- n 1)))
    )
  )
)
(fact 3)
# @davepagurek/qpsolver

Do you have some math to do and need a quadratic programming solver? Has the universe conspired to force you to do it in the browser, where you have none of the tools that actual mathematicians would use? I'm in the same boat!

This library provides an interface to build up expressions you want to optimize. The underlying solver is the <a href="https://github.com/albertosantini/quadprog">`quadprog` library</a>, which is a JavaScript port of the <a href="http://cran.r-project.org/web/packages/quadprog/">R package `quadprog`</a>, which is implemented in Fortran, and just takes in big matrices and vectors for all your terms. This library translates more readable expressions into that format.

## Usage

Import `QPSolver` from the library and use it to create a new system. You can **create variables** using the solver's `createVarible()` method. You can then call `.add()`, `.mult()`, `.sub()`, and `.div()` to construct expressions based on your variables. To each operator, you can pass in other variables, expressions, or numbers.

Tell the system what to minimize with `.addCost()`, and then you can solve your system with `.solve()`. Afterwards, you can call `.value()` on a variable to find the value minimizing the system:

```js
import { QPSolver } from '@davepagurek/qpsolver'

const solver = new QPSolver()
const x = solver.createVariable()

// Minimize x^2 + x
solver.addCost(x.mult(x).add(x))

solver.solve()
console.log(x.value()) // Logs -0.5
```

It also supports multiple variables:
```js
import { QPSolver } from '@davepagurek/qpsolver'

const solver = new QPSolver()
const x1 = solver.createVariable()
const x2 = solver.createVariable()

// Minimize (x1 - 1)^2 + (x2 - 2)^2
solver.addCost(x1.sub(1).mult(x1.sub(1)))
solver.addCost(x2.sub(2).mult(x2.sub(2)))

solver.solve()
console.log(x1.value()) // Logs 1
console.log(x2.value()) // Logs 2
```

You can also **create constraints** by calling `.gt()`, `.lt()`, or `.eq()` on an expression and passing in another expression, variable, or number. You can attach it to the system via its `addConstraint` method:

```js
import { QPSolver } from '@davepagurek/qpsolver'

const solver = new QPSolver()
const x = solver.createVariable()

// Minimize x^2 + x, given x >= 0
solver.addCost(x.mult(x).add(x))
solver.addConstraint(x.gt(0))

solver.solve()
console.log(x.value()) // Logs 0
```

Remember, this solves quadratic programming problems with linear constraints. That means:
- Be careful dividing variables by other variables! If you end up with a rational expression, e.g. `(x1 + 1) / (x2 + 1)`, the solver will throw an error.
- You can't create cubic (or higher!) terms, that will also throw an error.

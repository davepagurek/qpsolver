import { QPSolver } from '../src/QPSolver'

describe('QPSolver basic functionality', () => {
  it('solves with a constraint x >= 1', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x)
    solver.addCost(x.mult(x).mult(1e-8))
    solver.addConstraint(x.gt(1))

    solver.solve()
    expect(x.value()).toBeCloseTo(1)
  })

  it('solves x^2 + x', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x.mult(x).add(x))

    solver.solve()
    expect(x.value()).toBeCloseTo(-0.5)
  })

  it('solves x^2 + x with constraint x >= 0', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x.mult(x).add(x))
    solver.addConstraint(x.gt(0))

    solver.solve()
    expect(x.value()).toBeCloseTo(0)
  })

  it('solves 0.5 * x^2 - x with constraint x <= 2', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x.mult(x).mult(0.5).add(x.mult(-1)))
    solver.addConstraint(x.lt(2))

    solver.solve()
    expect(x.value()).toBeCloseTo(1)
  })

  it('handles equality constraint x = 3', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x.mult(x))
    solver.addConstraint(x.eq(3))

    solver.solve()
    expect(x.value()).toBeCloseTo(3)
  })

  it('handles two variables with quadratic cost (x1-1)^2 + (x2-2)^2', () => {
    const solver = new QPSolver()
    const x1 = solver.createVariable()
    const x2 = solver.createVariable()

    solver.addCost(x1.sub(1).mult(x1.sub(1)))
    solver.addCost(x2.sub(2).mult(x2.sub(2)))

    solver.solve()
    expect(x1.value()).toBeCloseTo(1)
    expect(x2.value()).toBeCloseTo(2)
  })

  it('handles a cost term with a constant', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addCost(x.mult(x).add(x).add(5))

    solver.solve()
    expect(x.value()).toBeCloseTo(-0.5)
  })

  it('solves x / 2 == 3', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    solver.addConstraint(x.div(2).eq(3))

    solver.solve()

    expect(x.value()).toBeCloseTo(6)
  })

  it('solves x^2 / x == 4', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    const quadraticTerm = x.mult(x)
    solver.addConstraint(quadraticTerm.div(x).eq(4))

    solver.solve()

    expect(x.value()).toBeCloseTo(4)
  })

  it('solves (x + 4) / 2 == 5', () => {
    const solver = new QPSolver()
    const x = solver.createVariable()

    const left = x.add(4).div(2)
    solver.addConstraint(left.eq(5))

    solver.solve()

    expect(x.value()).toBeCloseTo(6)
  })

  describe('invalid expressions', () => {
    it('throws when creating a rational expression by dividing by multiple terms', () => {
      const solver = new QPSolver()
      const x = solver.createVariable()
      const y = solver.createVariable()

      const denominator = x.add(y)

      expect(() => {
        solver.toTerms(1).div(denominator)
      }).toThrow('Division would produce a rational expression')
    })

    it('throws when creating a cubic expression by multiplying quadratic terms', () => {
      const solver = new QPSolver()
      const x = solver.createVariable()
      const quadratic = x.mult(x)

      expect(() => {
        quadratic.mult(x)
      }).toThrow("Can't perform multiplication, would be cubic!")
    })
  })

  describe('unbound variable behavior', () => {
    it('assigns zero to an unbound variable not present in cost or constraints', () => {
      const solver = new QPSolver()
      const x = solver.createVariable()
      const y = solver.createVariable() // unbound variable

      // Add constraint and cost only involving x
      solver.addConstraint(x.eq(3))
      solver.addCost(x)

      solver.solve()

      expect(x.value()).toBeCloseTo(3)
      expect(y.value()).toBeCloseTo(0) // y is not constrained or in cost
    })
  })
})

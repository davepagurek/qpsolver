import quadprog from 'quadprog'

export class QPVariable {
  constructor(public solver: QPSolver) {
    solver.variables.push(this)
    this.index = solver.variables.length
  }

  value() {
    if (!this.solver.solution) {
      throw new Error(
        'The solver must find a solution before getting variable values!',
      )
    }
    return this.solver.solution[this.index]
  }

  add(other: QPExpression) {
    return this.solver.toTerms(this).add(other)
  }
  sub(other: QPExpression) {
    return this.solver.toTerms(this).sub(other)
  }
  mult(other: QPExpression) {
    return this.solver.toTerms(this).mult(other)
  }
  div(other: QPExpression) {
    return this.solver.toTerms(this).div(other)
  }
  gt(other: QPExpression) {
    return this.solver.toTerms(this).gt(other)
  }
  lt(other: QPExpression) {
    return this.solver.toTerms(this).lt(other)
  }
  eq(other: QPExpression) {
    return this.solver.toTerms(this).eq(other)
  }

  public index: number
}

/**
 * A data structure containing terms, where we want the
 * sum of the terms to be >= 0.
 */
export class QPConstraint {
  constructor(
    public solver: QPSolver,
    public op: 'gt' | 'eq',
    public term: QPTerms,
  ) {}
}

type QPExpression = number | QPVariable | QPTerms

export class QPTerms {
  constructor(public solver: QPSolver) {}

  clone() {
    const other = new QPTerms(this.solver)
    other.terms = this.terms.map((col) => col && [...col])
    return other
  }

  /**
   * A matrix of multipliers for each term which will get summed together.
   * The 0th row/column represents 1, and the
   * ith row/column represents the variable x_i (where i is 1-indexed -- there
   * is no x_0.)
   *
   * For example:
   * terms[0][0] = 2 represents 2
   * terms[1][0] = 3 represents 3 x_1
   * terms[2][1] = 4 represents 4 x_2 x_1
   * terms[2][2] = 4 represents 4 x_2^2
   *
   * Indices should always go in descending order. e.g. terms[2][1] is valid,
   * and although terms[1][2] would be mathematically equivalent, it should be
   * unused.
   */
  terms: number[][] = []

  addTerms(other: QPTerms) {
    for (let i = 0; i < other.terms.length; i++) {
      this.terms[i] = this.terms[i] || []
      const col = other.terms[i] || []
      for (let j = 0; j < col.length; j++) {
        this.terms[i][j] = this.terms[i][j] || 0
        this.terms[i][j] += col[j] || 0
      }
    }
    return this
  }

  addVariable(other: QPVariable) {
    this.terms[other.index] = this.terms[other.index] || []
    this.terms[other.index][0] = this.terms[other.index][0] || 0
    this.terms[other.index][0]++
    return this
  }

  addConstant(other: number) {
    this.terms[0] = this.terms[0] || []
    this.terms[0][0] = this.terms[0][0] || 0
    this.terms[0][0] += other
    return this
  }

  multiplyConstant(other: number) {
    for (let i = 0; i < this.terms.length; i++) {
      if (!this.terms[i]) continue
      for (let j = 0; j < this.terms[i].length; j++) {
        this.terms[i][j] = (this.terms[i][j] || 0) * other
      }
    }
    return this
  }

  multiplyVariable(other: QPVariable) {
    const oldTerms = this.terms
    this.terms = []
    for (let i = 0; i < oldTerms.length; i++) {
      if (!oldTerms[i]) continue
      for (let j = 0; j < oldTerms[i].length; j++) {
        if (oldTerms[i][j] && i !== 0 && j !== 0) {
          throw new Error("Can't perform multiplication, would be cubic!")
        }
        const oldVarIdx = Math.max(i, j) // At least one of these is 0, grab the other
        const newVarIdx = other.index
        const a = Math.max(oldVarIdx, newVarIdx)
        const b = Math.min(oldVarIdx, newVarIdx)

        this.terms[a] = this.terms[a] || []
        this.terms[a][b] = this.terms[a][b] || 0
        this.terms[a][b] = oldTerms[i][j]
      }
    }
    return this
  }

  multiplyTerms(other: QPTerms) {
    const resultTerms: number[][] = []

    for (let i = 0; i < this.terms.length; i++) {
      const rowA = this.terms[i]
      if (!rowA) continue
      for (let j = 0; j < rowA.length; j++) {
        const coeffA = rowA[j]
        if (!coeffA) continue

        for (let k = 0; k < other.terms.length; k++) {
          const rowB = other.terms[k]
          if (!rowB) continue
          for (let l = 0; l < rowB.length; l++) {
            const coeffB = rowB[l]
            if (!coeffB) continue

            // Combine indices
            const indices = [i, j, k, l].filter((idx) => idx !== 0)
            if (indices.length > 2) {
              throw new Error('Multiplying terms would result in cubic term')
            }

            let a = 0,
              b = 0
            if (indices.length === 2) {
              ;[a, b] = indices.sort((a, b) => b - a)
            } else if (indices.length === 1) {
              a = indices[0]
              b = 0
            }

            resultTerms[a] = resultTerms[a] || []
            resultTerms[a][b] = (resultTerms[a][b] || 0) + coeffA * coeffB
          }
        }
      }
    }

    this.terms = resultTerms
    return this
  }

  divideTerms(other: QPTerms) {
    // Identify single non-zero divisor term
    let divisorCoeff = 0
    let divisorI = -1,
      divisorJ = -1

    for (let i = 0; i < other.terms.length; i++) {
      const row = other.terms[i]
      if (!row) continue
      for (let j = 0; j < row.length; j++) {
        const coeff = row[j]
        if (!coeff) continue
        if (divisorCoeff !== 0) {
          throw new Error(
            'Division would produce a rational expression (multiple divisor terms)',
          )
        }
        divisorCoeff = coeff
        divisorI = i
        divisorJ = j
      }
    }

    if (divisorCoeff === 0) {
      throw new Error('Cannot divide by zero')
    }

    const divisorVars: number[] = []
    if (divisorI !== 0) divisorVars.push(divisorI)
    if (divisorJ !== 0) divisorVars.push(divisorJ)

    const resultTerms: number[][] = []

    for (let i = 0; i < this.terms.length; i++) {
      const row = this.terms[i]
      if (!row) continue
      for (let j = 0; j < row.length; j++) {
        const coeff = row[j]
        if (!coeff) continue

        const termVars: number[] = []
        if (i !== 0) termVars.push(i)
        if (j !== 0) termVars.push(j)

        // Create a combined list of variables in this term
        const totalVars = termVars.concat(divisorVars.map((v) => -v))

        // Count occurrences: positive count means leftover variables in numerator
        const varCounts = new Map<number, number>()
        for (const v of totalVars) {
          const absV = Math.abs(v)
          const sign = v > 0 ? 1 : -1
          varCounts.set(absV, (varCounts.get(absV) || 0) + sign)
        }

        // Ensure no variable count goes negative
        for (const [v, count] of varCounts.entries()) {
          if (count < 0) {
            throw new Error(
              `Cannot divide term (${i},${j}) by divisor (${divisorI},${divisorJ}), would create negative power of x_${v}`,
            )
          }
        }

        // Extract remaining variables after division
        const remainingVars: number[] = []
        for (const [v, count] of varCounts.entries()) {
          for (let c = 0; c < count; c++) remainingVars.push(v)
        }

        let a = 0,
          b = 0
        if (remainingVars.length === 2) {
          ;[a, b] = remainingVars.sort((a, b) => b - a)
        } else if (remainingVars.length === 1) {
          a = remainingVars[0]
          b = 0
        }

        resultTerms[a] = resultTerms[a] || []
        resultTerms[a][b] = (resultTerms[a][b] || 0) + coeff / divisorCoeff
      }
    }

    this.terms = resultTerms
    return this
  }

  divideConstant(value: number) {
    if (value === 0) throw new Error('Cannot divide by zero')

    for (let i = 0; i < this.terms.length; i++) {
      const row = this.terms[i]
      if (!row) continue
      for (let j = 0; j < row.length; j++) {
        if (row[j] !== undefined && row[j] !== 0) {
          row[j] /= value
        }
      }
    }
    return this
  }

  divideVariable(variable: QPVariable) {
    const divisor = new QPTerms(this.solver)
    divisor.terms[variable.index] = divisor.terms[variable.index] || []
    divisor.terms[variable.index][0] = 1
    return this.divideTerms(divisor)
  }

  add(other: QPExpression) {
    if (other instanceof QPTerms) {
      return this.addTerms(other)
    } else if (other instanceof QPVariable) {
      return this.addVariable(other)
    } else {
      return this.addConstant(other)
    }
  }

  mult(other: QPExpression) {
    if (other instanceof QPTerms) {
      return this.multiplyTerms(other)
    } else if (other instanceof QPVariable) {
      return this.multiplyVariable(other)
    } else {
      return this.multiplyConstant(other)
    }
  }

  sub(other: QPExpression) {
    return this.add(new QPTerms(this.solver).add(other).mult(-1))
  }

  div(other: QPExpression) {
    if (other instanceof QPTerms) {
      return this.divideTerms(other)
    } else if (other instanceof QPVariable) {
      return this.divideVariable(other)
    } else {
      return this.divideConstant(other)
    }
  }

  gt(other: QPExpression) {
    return new QPConstraint(this.solver, 'gt', this.clone().sub(other))
  }

  lt(other: QPExpression) {
    return new QPConstraint(this.solver, 'gt', this.clone().sub(other).mult(-1))
  }

  eq(other: QPExpression) {
    return new QPConstraint(this.solver, 'eq', this.clone().sub(other))
  }
}

export class QPSolver {
  public variables: QPVariable[] = []

  solution?: number[]
  constraints: QPConstraint[] = []
  cost = new QPTerms(this)

  createVariable() {
    return new QPVariable(this)
  }

  toTerms(other: QPExpression) {
    if (other instanceof QPTerms) {
      return other
    } else if (other instanceof QPVariable) {
      return new QPTerms(this).addVariable(other)
    } else {
      return new QPTerms(this).addConstant(other)
    }
  }

  add(a: QPExpression, b: QPExpression) {
    return this.toTerms(a).clone().add(b)
  }

  sub(a: QPExpression, b: QPExpression) {
    return this.toTerms(a).clone().sub(b)
  }

  mult(a: QPExpression, b: QPExpression) {
    return this.toTerms(a).clone().mult(b)
  }

  div(a: QPExpression, b: QPExpression) {
    return this.toTerms(a).clone().div(b)
  }

  addConstraint(c: QPConstraint) {
    this.constraints.push(c)
  }

  addCost(c: QPExpression) {
    this.cost.add(c)
    return this
  }

  solve() {
    /*
    Required by quadprog:
    Dmat: indexed from 1, symmetric, quadratic terms.
    dvec: captures linear terms, negated as per quadprog's objective.
    Amat, bvec: encode constraints with A^T b (op) b_0, where
      the first meq rows use = and the rest use >=.
    */

    const n = this.variables.length

    // Separate equality and inequality constraints
    const eqConstraints = this.constraints.filter((c) => c.op === 'eq')
    const gtConstraints = this.constraints.filter((c) => c.op === 'gt')
    const meq = eqConstraints.length
    const m = this.constraints.length

    // Dmat and dvec (cost terms)
    const Dmat = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0))
    const dvec = Array(n + 1).fill(0)

    for (let i = 1; i < this.cost.terms.length; i++) {
      const row = this.cost.terms[i]
      if (!row) continue
      for (let j = 0; j < row.length; j++) {
        const coeff = row[j] || 0
        if (coeff === 0) continue
        if (j === 0) {
          if (i <= n) dvec[i] -= coeff
        } else {
          if (i <= n && j <= n) {
            Dmat[i][j] += coeff
            Dmat[j][i] += coeff
          }
        }
      }
    }

    // Add regularization if Dmat is all zeros (ignoring index 0). Otherwise,
    // purely linear problems may not work.
    let hasQuadraticTerm = false
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        if (Dmat[i][j] !== 0) {
          hasQuadraticTerm = true
          break
        }
      }
      if (hasQuadraticTerm) break
    }
    if (!hasQuadraticTerm) {
      const regularization = 1e-8
      for (let i = 1; i <= n; i++) {
        Dmat[i][i] = regularization
      }
    }

    // Amat and bvec
    const Amat = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
    const bvec = Array(m + 1).fill(0)

    const processConstraint = (
      constraint: QPConstraint,
      constraintIdx: number,
    ) => {
      const terms = constraint.term.terms
      let constant = 0
      if (terms[0]?.[0]) constant = terms[0][0]

      for (let i = 1; i < terms.length; i++) {
        const row = terms[i]
        if (!row) continue
        if (row[0]) {
          if (i <= n) Amat[i][constraintIdx + 1] = row[0]
        }
        for (let j = 1; j < row.length; j++) {
          if (row[j]) {
            throw new Error(
              `Constraint ${constraintIdx} contains quadratic terms, which are unsupported.`,
            )
          }
        }
      }
      bvec[constraintIdx + 1] = -constant
    }

    // Equality constraints must come before inequality constraints in the final matrix
    eqConstraints.forEach((c, idx) => processConstraint(c, idx))
    gtConstraints.forEach((c, idx) => processConstraint(c, meq + idx))

    const result = quadprog.solveQP(Dmat, dvec, Amat, bvec, meq)

    this.solution = result.solution
  }
}

import { describe, expect, it } from "vitest";
import { StateVectorSimulator } from "../simulator/StateVectorSimulator";

describe("StateVectorSimulator", () => {
  it("produces a Bell-state probability distribution", async () => {
    const source = "fn bell() {\n let q = new Qubit[2];\n H(q[0]);\n X(q[1]).controlled(q[0]);\n}";
    const result = await new StateVectorSimulator().run(source, 100);
    expect(result.probabilities["00"]).toBeCloseTo(0.5);
    expect(result.probabilities["11"]).toBeCloseTo(0.5);
  });
});

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "jest",
  mutate: ["src/utils/appointmentStateMachine.js"],
  jest: {
    projectType: "custom",
    configFile: "jest.config.js",
  },
  reporters: ["html", "clear-text"],
  coverageAnalysis: "perTest",
};

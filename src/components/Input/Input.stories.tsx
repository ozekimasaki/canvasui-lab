import { Input } from "./Input";

export default {
  title: "Input",
  component: Input,
  parameters: {
    matrix: {
      axes: {
        size: ["sm", "md", "lg"],
        state: ["default", "hover", "focus", "disabled"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const Empty = { args: {} };
export const Filled = { args: { defaultValue: "ada@example.com" } };

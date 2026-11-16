import { Button } from "./Button";

export default {
  title: "Button",
  component: Button,
  parameters: {
    matrix: {
      axes: {
        size: ["sm", "md", "lg"],
        variant: ["solid", "outline", "ghost"],
        state: ["default", "hover", "focus", "disabled"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const Solid = { args: { variant: "solid", label: "Continue" } };
export const Outline = { args: { variant: "outline", label: "Continue" } };
export const Ghost = { args: { variant: "ghost", label: "Continue" } };

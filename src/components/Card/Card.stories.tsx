import { Card } from "./Card";

export default {
  title: "Card",
  component: Card,
  parameters: {
    matrix: {
      axes: {
        variant: ["plain", "outlined", "elevated"],
        state: ["default", "hover"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const Outlined = { args: { variant: "outlined" } };
export const Elevated = { args: { variant: "elevated" } };

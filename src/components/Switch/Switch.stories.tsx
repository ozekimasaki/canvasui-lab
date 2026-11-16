import { Switch } from "./Switch";

export default {
  title: "Switch",
  component: Switch,
  parameters: {
    matrix: {
      axes: {
        checked: ["true", "false"],
        state: ["default", "hover", "focus", "disabled"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const On = { args: { checked: true } };
export const Off = { args: { checked: false } };

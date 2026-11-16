import { Alert } from "./Alert";

export default {
  title: "Alert",
  component: Alert,
  parameters: {
    matrix: {
      axes: {
        variant: ["info", "success", "warning", "error"],
        size: ["sm", "md", "lg"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const Info = { args: { variant: "info" } };
export const Error = {
  args: { variant: "error", title: "Failed", message: "The upload could not be completed." },
};

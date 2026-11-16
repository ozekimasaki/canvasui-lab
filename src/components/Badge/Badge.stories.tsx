import { Badge } from "./Badge";

export default {
  title: "Badge",
  component: Badge,
  parameters: {
    matrix: {
      axes: {
        variant: ["neutral", "primary", "success", "warning", "danger"],
        size: ["sm", "md", "lg"],
        theme: ["light", "dark"],
      },
    },
  },
};

export const Neutral = { args: { variant: "neutral" } };
export const Success = { args: { variant: "success", label: "Active" } };

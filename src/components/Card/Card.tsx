import type { ForceState } from "../types";

export interface CardProps {
  variant?: "plain" | "outlined" | "elevated";
  state?: ForceState;
  title?: string;
  body?: string;
}

export function Card({
  variant = "outlined",
  state = "default",
  title = "Card title",
  body = "Supporting text that describes the card content in one or two lines.",
}: CardProps) {
  return (
    <article data-component="Card" data-variant={variant} data-state={state}>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

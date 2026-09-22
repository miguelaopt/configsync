/** The bits of Paddle.js we call, in one place so both checkout surfaces agree on the shape. */
export type PaddleJs = {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (o: {
    token: string;
    eventCallback?: (e: { name: string; detail?: unknown }) => void;
  }) => void;
  Checkout: {
    open: (o: {
      items: { priceId: string; quantity: number }[];
      discountCode?: string;
      customer?: { email: string };
      customData?: Record<string, string>;
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

export const PADDLE_JS_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

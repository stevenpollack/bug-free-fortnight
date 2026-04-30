// Augment bun:test with @testing-library/jest-dom matchers for Bun.
// We inline the augmentation to avoid import resolution issues with
// @testing-library/jest-dom/types/matchers which uses CommonJS `export =`.
declare module "bun:test" {
  interface Matchers<T> {
    toBeInTheDocument(): void;
    toBeVisible(): void;
    toBeDisabled(): void;
    toBeEnabled(): void;
    toBeChecked(): void;
    toBeEmpty(): void;
    toBeEmptyDOMElement(): void;
    toContainElement(element: HTMLElement | SVGElement | null): void;
    toContainHTML(htmlText: string): void;
    toHaveAttribute(attr: string, value?: unknown): void;
    toHaveClass(...classNames: string[]): void;
    toHaveFocus(): void;
    toHaveFormValues(expectedValues: Record<string, unknown>): void;
    toHaveStyle(css: string | Record<string, unknown>): void;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
    toHaveValue(value?: string | string[] | number | null): void;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): void;
    toBeRequired(): void;
    toBeInvalid(): void;
    toBeValid(): void;
    toHaveDescription(text?: string | RegExp): void;
    toHaveErrorMessage(text?: string | RegExp): void;
    toHaveAccessibleName(text?: string | RegExp): void;
    toHaveAccessibleDescription(text?: string | RegExp): void;
    toBePartiallyChecked(): void;
  }
}

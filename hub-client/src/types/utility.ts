/**
 * Utility type to make property K of type T required.
 *
 * @author Vojtěch Strnad
 * @see https://stackoverflow.com/a/69328045
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

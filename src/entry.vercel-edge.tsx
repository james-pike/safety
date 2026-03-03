/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Node.js server adapter for Vercel.
 */
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
});

export { router, notFound, staticFile };

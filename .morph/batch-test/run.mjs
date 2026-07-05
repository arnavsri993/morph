#!/usr/bin/env node
/**
 * Batch transform stress test — 100 randomized GitHub repos / frontend URLs.
 * Usage: node .morph/batch-test/run.mjs [--count 100] [--concurrency 8]
 */

import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloneRepo } from "../../src/github.js";
import { fetchPageForTransform } from "../../src/preview.js";
import { transformSite } from "../../src/transform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "results");
const RUNS_DIR = path.join(__dirname, "runs");

/** @type {{ type: "repo" | "url", id: string }[]} */
const SOURCE_POOL = [
  // MDN / educational
  { type: "repo", id: "mdn/beginner-html-site" },
  { type: "repo", id: "mdn/learning-area" },
  { type: "repo", id: "mdn/css-examples" },
  { type: "repo", id: "mdn/html-examples" },
  { type: "repo", id: "freeCodeCamp/catphotoapp" },
  { type: "repo", id: "freeCodeCamp/responsive-web-design-certification-projects" },
  // Tutorial / demo repos
  { type: "repo", id: "bradtraversy/50projects50days" },
  { type: "repo", id: "jonasschmedtmann/html-css-course" },
  { type: "repo", id: "wesbos/JavaScript30" },
  { type: "repo", id: "jlord/hello" },
  { type: "repo", id: "LeaVerou/css3patterns" },
  { type: "repo", id: "bradtraversy/loruki-website" },
  { type: "repo", id: "bradtraversy/vanillawebprojects" },
  { type: "repo", id: "bradtraversy/traversy-ui" },
  { type: "repo", id: "codingforentrepreneurs/landing-page" },
  // StartBootstrap templates
  { type: "repo", id: "StartBootstrap/startbootstrap-landing-page" },
  { type: "repo", id: "StartBootstrap/startbootstrap-agency" },
  { type: "repo", id: "StartBootstrap/startbootstrap-creative" },
  { type: "repo", id: "StartBootstrap/startbootstrap-grayscale" },
  { type: "repo", id: "StartBootstrap/startbootstrap-new-age" },
  { type: "repo", id: "StartBootstrap/startbootstrap-resume" },
  { type: "repo", id: "StartBootstrap/startbootstrap-freelancer" },
  { type: "repo", id: "StartBootstrap/startbootstrap-clean-blog" },
  { type: "repo", id: "StartBootstrap/startbootstrap-stylish-portfolio" },
  { type: "repo", id: "StartBootstrap/startbootstrap-business-casual" },
  { type: "repo", id: "StartBootstrap/startbootstrap-sb-admin" },
  { type: "repo", id: "StartBootstrap/startbootstrap-sb-admin-2" },
  { type: "repo", id: "StartBootstrap/startbootstrap-coming-soon" },
  { type: "repo", id: "StartBootstrap/startbootstrap-one-page-wonder" },
  { type: "repo", id: "StartBootstrap/startbootstrap-modern-business" },
  { type: "repo", id: "StartBootstrap/startbootstrap-shop-homepage" },
  { type: "repo", id: "StartBootstrap/startbootstrap-personal" },
  { type: "repo", id: "StartBootstrap/startbootstrap-bare" },
  { type: "repo", id: "StartBootstrap/startbootstrap-simple-sidebar" },
  { type: "repo", id: "StartBootstrap/startbootstrap-scrolling-nav" },
  { type: "repo", id: "StartBootstrap/startbootstrap-heroic-features" },
  { type: "repo", id: "StartBootstrap/startbootstrap-small-business" },
  { type: "repo", id: "StartBootstrap/startbootstrap-business-frontpage" },
  // HTML5 UP (ajlkn)
  { type: "repo", id: "ajlkn/solid-state" },
  { type: "repo", id: "ajlkn/stellar" },
  { type: "repo", id: "ajlkn/spectral" },
  { type: "repo", id: "ajlkn/phantom" },
  { type: "repo", id: "ajlkn/miniport" },
  { type: "repo", id: "ajlkn/forty" },
  { type: "repo", id: "ajlkn/escape-velocity" },
  { type: "repo", id: "ajlkn/alpha" },
  { type: "repo", id: "ajlkn/landed" },
  { type: "repo", id: "ajlkn/identity" },
  // More static frontends
  { type: "repo", id: "jgthms/bulma" },
  { type: "repo", id: "twbs/bootstrap" },
  { type: "repo", id: "tailwindlabs/tailwindcss.com" },
  { type: "repo", id: "vercel/next.js" },
  { type: "repo", id: "gatsbyjs/gatsby-starter-default" },
  { type: "repo", id: "withastro/astro" },
  { type: "repo", id: "sveltejs/svelte" },
  { type: "repo", id: "vuejs/vue" },
  { type: "repo", id: "facebook/create-react-app" },
  { type: "repo", id: "Hacker0x01/hacker101" },
  { type: "repo", id: "pallets/flask" },
  { type: "repo", id: "django/django" },
  { type: "repo", id: "expressjs/express" },
  { type: "repo", id: "lodash/lodash" },
  { type: "repo", id: "moment/momentjs.com" },
  { type: "repo", id: "jquery/jquery" },
  { type: "repo", id: "electron/electron" },
  { type: "repo", id: "nodejs/node" },
  { type: "repo", id: "microsoft/vscode" },
  { type: "repo", id: "rust-lang/www.rust-lang.org" },
  { type: "repo", id: "golang/go" },
  { type: "repo", id: "python/cpython" },
  { type: "repo", id: "ruby/ruby" },
  { type: "repo", id: "php/php-src" },
  { type: "repo", id: "kubernetes/website" },
  { type: "repo", id: "docker/docs" },
  { type: "repo", id: "hashicorp/terraform" },
  { type: "repo", id: "ansible/ansible" },
  { type: "repo", id: "grafana/grafana" },
  { type: "repo", id: "prometheus/prometheus" },
  { type: "repo", id: "elastic/elasticsearch" },
  { type: "repo", id: "redis/redis" },
  { type: "repo", id: "mongodb/mongo" },
  { type: "repo", id: "postgres/postgres" },
  { type: "repo", id: "supabase/supabase" },
  { type: "repo", id: "prisma/prisma" },
  { type: "repo", id: "stripe/stripe-node" },
  { type: "repo", id: "twilio/twilio-node" },
  { type: "repo", id: "sendgrid/sendgrid-nodejs" },
  { type: "repo", id: "auth0/node-auth0" },
  { type: "repo", id: "clerk/javascript" },
  { type: "repo", id: "supabase/supabase-js" },
  { type: "repo", id: "firebase/firebase-js-sdk" },
  { type: "repo", id: "aws/aws-sdk-js" },
  { type: "repo", id: "googleapis/google-api-nodejs-client" },
  { type: "repo", id: "octocat/Hello-World" },
  { type: "repo", id: "github/choosealicense.com" },
  { type: "repo", id: "github/explore" },
  { type: "repo", id: "github/markup" },
  { type: "repo", id: "github/linguist" },
  { type: "repo", id: "github/opensource.guide" },
  { type: "repo", id: "github/super-linter" },
  { type: "repo", id: "github/roadmap" },
  { type: "repo", id: "github/docs" },
  { type: "repo", id: "github/feedback" },
  { type: "repo", id: "github/securitylab" },
  { type: "repo", id: "github/advisory-database" },
  { type: "repo", id: "github/copilot-docs" },
  { type: "repo", id: "github/branch-protection" },
  { type: "repo", id: "github/renaming" },
  { type: "repo", id: "github/haikus-for-codespaces" },
  // Bootstrap doc examples (URLs)
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/album/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/cheatsheet/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/cover/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/carousel/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/dashboard/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/pricing/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/sign-in/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/sticky-footer/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/heroes/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/features/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/headers/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/list-groups/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/modals/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/offcanvas/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/jumbotrons/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/badges/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/breadcrumbs/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/buttons/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/dropdowns/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/navbars/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/navbar-fixed/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/checkout/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/product/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/blog/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/cards/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/grid/" },
  { type: "url", id: "https://getbootstrap.com/docs/5.3/examples/masonry/" },
  // W3Schools how-to demos
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_landing_page.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_website.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_portfolio_gallery.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_contact_form.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_login_form.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_responsive.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_parallax.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_css_full_page.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_accordion.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_tabs.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_slideshow.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_modal.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_typewriter.asp" },
  { type: "url", id: "https://www.w3schools.com/howto/howto_js_navbar_sticky.asp" },
  // Public marketing / docs pages
  { type: "url", id: "https://example.com" },
  { type: "url", id: "https://www.w3.org/standards/" },
  { type: "url", id: "https://developer.mozilla.org/en-US/" },
  { type: "url", id: "https://tailwindcss.com" },
  { type: "url", id: "https://vercel.com" },
  { type: "url", id: "https://stripe.com" },
  { type: "url", id: "https://linear.app" },
  { type: "url", id: "https://www.notion.so" },
  { type: "url", id: "https://www.figma.com" },
  { type: "url", id: "https://github.com" },
  { type: "url", id: "https://supabase.com" },
  { type: "url", id: "https://www.cloudflare.com" },
  { type: "url", id: "https://www.docker.com" },
  { type: "url", id: "https://www.digitalocean.com" },
  { type: "url", id: "https://www.netlify.com" },
  { type: "url", id: "https://react.dev" },
  { type: "url", id: "https://vuejs.org" },
  { type: "url", id: "https://svelte.dev" },
  { type: "url", id: "https://astro.build" },
  { type: "url", id: "https://www.prisma.io" },
  { type: "url", id: "https://www.anthropic.com" },
  { type: "url", id: "https://openai.com" },
  { type: "url", id: "https://www.npmjs.com" },
  { type: "url", id: "https://nodejs.org/en" },
  { type: "url", id: "https://www.rust-lang.org" },
  { type: "url", id: "https://go.dev" },
  { type: "url", id: "https://www.python.org" },
  { type: "url", id: "https://www.w3schools.com/html/" },
  { type: "url", id: "https://www.w3schools.com/css/" },
  { type: "url", id: "https://www.w3schools.com/bootstrap5/" },
  { type: "url", id: "https://html5up.net/stellar" },
  { type: "url", id: "https://html5up.net/spectral" },
  { type: "url", id: "https://html5up.net/phantom" },
  { type: "url", id: "https://html5up.net/miniport" },
  { type: "url", id: "https://html5up.net/forty" },
  { type: "url", id: "https://html5up.net/alpha" },
  { type: "url", id: "https://html5up.net/landed" },
  { type: "url", id: "https://html5up.net/identity" },
  { type: "url", id: "https://html5up.net/solid-state" },
  { type: "url", id: "https://html5up.net/escape-velocity" },
  { type: "url", id: "https://www.creative-tim.com/product/soft-ui-dashboard" },
  { type: "url", id: "https://www.creative-tim.com/product/material-dashboard" },
  { type: "url", id: "https://www.creative-tim.com/product/argon-dashboard" },
  { type: "url", id: "https://www.creative-tim.com/product/notus-js" },
  { type: "url", id: "https://www.creative-tim.com/product/tailwind-starter-kit" },
  { type: "url", id: "https://demos.creative-tim.com/soft-ui-dashboard/pages/dashboard.html" },
  { type: "url", id: "https://demos.creative-tim.com/material-dashboard/examples/dashboard.html" },
  { type: "url", id: "https://demos.creative-tim.com/argon-dashboard/index.html" },
  { type: "url", id: "https://demos.creative-tim.com/notus-js/pages/landing.html" },
  { type: "url", id: "https://www.heropatterns.com/" },
  { type: "url", id: "https://www.colorlib.com/wp/template/" },
  { type: "url", id: "https://templated.co/live" },
  { type: "url", id: "https://www.free-css.com/free-css-templates" },
  { type: "url", id: "https://www.tooplate.com/live" },
  { type: "url", id: "https://www.zyro.com/templates" },
  { type: "url", id: "https://www.squarespace.com/templates" },
  { type: "url", id: "https://www.wix.com/website/templates" },
  { type: "url", id: "https://webflow.com/templates" },
  { type: "url", id: "https://www.framer.com/templates/" },
  { type: "url", id: "https://www.canva.com/templates/" },
  { type: "url", id: "https://www.hubspot.com/products/cms/website-templates" },
  { type: "url", id: "https://wordpress.org/themes/" },
  { type: "url", id: "https://themes.shopify.com/" },
  { type: "url", id: "https://themeforest.net/category/site-templates" },
  { type: "url", id: "https://www.awwwards.com/websites/" },
  { type: "url", id: "https://www.lapa.ninja/" },
  { type: "url", id: "https://www.landingfolio.com/" },
  { type: "url", id: "https://saaslandingpage.com/" },
  { type: "url", id: "https://www.saasframe.io/" },
  { type: "url", id: "https://www.pageflows.com/" },
  { type: "url", id: "https://mobbin.com/browse/web/screens" },
  { type: "url", id: "https://refero.design/" },
  { type: "url", id: "https://www.curated.design/" },
  { type: "url", id: "https://www.designspiration.com/" },
  { type: "url", id: "https://dribbble.com/tags/landing_page" },
  { type: "url", id: "https://www.behance.net/search/projects?search=landing%20page" },
  { type: "url", id: "https://www.producthunt.com/" },
  { type: "url", id: "https://news.ycombinator.com/" },
  { type: "url", id: "https://www.indiehackers.com/" },
  { type: "url", id: "https://www.reddit.com/r/webdev/" },
  { type: "url", id: "https://stackoverflow.com/" },
  { type: "url", id: "https://dev.to/" },
  { type: "url", id: "https://medium.com/" },
  { type: "url", id: "https://hashnode.com/" },
  { type: "url", id: "https://www.smashingmagazine.com/" },
  { type: "url", id: "https://css-tricks.com/" },
  { type: "url", id: "https://www.sitepoint.com/" },
  { type: "url", id: "https://www.codecademy.com/" },
  { type: "url", id: "https://www.khanacademy.org/computing" },
  { type: "url", id: "https://www.udemy.com/" },
  { type: "url", id: "https://www.coursera.org/" },
  { type: "url", id: "https://www.edx.org/" },
  { type: "url", id: "https://www.pluralsight.com/" },
  { type: "url", id: "https://frontendmasters.com/" },
  { type: "url", id: "https://egghead.io/" },
  { type: "url", id: "https://scrimba.com/" },
  { type: "url", id: "https://www.theodinproject.com/" },
  { type: "url", id: "https://www.freecodecamp.org/" },
  { type: "url", id: "https://exercism.org/" },
  { type: "url", id: "https://leetcode.com/" },
  { type: "url", id: "https://www.hackerrank.com/" },
  { type: "url", id: "https://www.codewars.com/" },
  { type: "url", id: "https://replit.com/" },
  { type: "url", id: "https://codesandbox.io/" },
  { type: "url", id: "https://stackblitz.com/" },
  { type: "url", id: "https://glitch.com/" },
  { type: "url", id: "https://codepen.io/" },
  { type: "url", id: "https://jsfiddle.net/" },
  { type: "url", id: "https://jsbin.com/" },
  { type: "url", id: "https://plnkr.co/" },
  { type: "url", id: "https://observablehq.com/" },
  { type: "url", id: "https://www.datadoghq.com/" },
  { type: "url", id: "https://sentry.io/" },
  { type: "url", id: "https://www.launchdarkly.com/" },
  { type: "url", id: "https://www.amplitude.com/" },
  { type: "url", id: "https://mixpanel.com/" },
  { type: "url", id: "https://posthog.com/" },
  { type: "url", id: "https://www.segment.com/" },
  { type: "url", id: "https://www.rudderstack.com/" },
  { type: "url", id: "https://www.heap.io/" },
  { type: "url", id: "https://www.hotjar.com/" },
  { type: "url", id: "https://www.fullstory.com/" },
  { type: "url", id: "https://www.logrocket.com/" },
  { type: "url", id: "https://www.bugsnag.com/" },
  { type: "url", id: "https://rollbar.com/" },
  { type: "url", id: "https://www.airbrake.io/" },
  { type: "url", id: "https://www.newrelic.com/" },
  { type: "url", id: "https://www.dynatrace.com/" },
  { type: "url", id: "https://www.appdynamics.com/" },
  { type: "url", id: "https://www.splunk.com/" },
  { type: "url", id: "https://www.elastic.co/" },
  { type: "url", id: "https://www.grafana.com/" },
  { type: "url", id: "https://prometheus.io/" },
  { type: "url", id: "https://www.influxdata.com/" },
  { type: "url", id: "https://www.timescale.com/" },
  { type: "url", id: "https://www.cockroachlabs.com/" },
  { type: "url", id: "https://planetscale.com/" },
  { type: "url", id: "https://neon.tech/" },
  { type: "url", id: "https://www.turso.tech/" },
  { type: "url", id: "https://www.upstash.com/" },
  { type: "url", id: "https://www.redis.io/" },
  { type: "url", id: "https://www.mongodb.com/" },
  { type: "url", id: "https://www.couchbase.com/" },
  { type: "url", id: "https://www.fauna.com/" },
  { type: "url", id: "https://firebase.google.com/" },
  { type: "url", id: "https://aws.amazon.com/" },
  { type: "url", id: "https://cloud.google.com/" },
  { type: "url", id: "https://azure.microsoft.com/" },
  { type: "url", id: "https://www.digitalocean.com/products/app-platform" },
  { type: "url", id: "https://render.com/" },
  { type: "url", id: "https://fly.io/" },
  { type: "url", id: "https://railway.app/" },
  { type: "url", id: "https://www.heroku.com/" },
  { type: "url", id: "https://www.linode.com/" },
  { type: "url", id: "https://www.vultr.com/" },
  { type: "url", id: "https://www.scaleway.com/" },
  { type: "url", id: "https://www.hetzner.com/" },
  { type: "url", id: "https://www.ovhcloud.com/" },
  { type: "url", id: "https://www.namecheap.com/" },
  { type: "url", id: "https://www.godaddy.com/" },
  { type: "url", id: "https://www.cloudflare.com/products/registrar/" },
  { type: "url", id: "https://domains.google/" },
  { type: "url", id: "https://www.porkbun.com/" },
  { type: "url", id: "https://www.gandi.net/" },
  { type: "url", id: "https://www.hover.com/" },
  { type: "url", id: "https://www.dnsimple.com/" },
  { type: "url", id: "https://www.cloudflare.com/learning/" },
  { type: "url", id: "https://developers.cloudflare.com/" },
  { type: "url", id: "https://docs.aws.amazon.com/" },
  { type: "url", id: "https://cloud.google.com/docs" },
  { type: "url", id: "https://learn.microsoft.com/en-us/azure/" },
  { type: "url", id: "https://kubernetes.io/docs/" },
  { type: "url", id: "https://docs.docker.com/" },
  { type: "url", id: "https://docs.github.com/" },
  { type: "url", id: "https://docs.gitlab.com/" },
  { type: "url", id: "https://bitbucket.org/product/guides" },
  { type: "url", id: "https://about.gitlab.com/" },
  { type: "url", id: "https://about.sourcegraph.com/" },
  { type: "url", id: "https://www.jetbrains.com/" },
  { type: "url", id: "https://code.visualstudio.com/" },
  { type: "url", id: "https://cursor.com/" },
  { type: "url", id: "https://www.warp.dev/" },
  { type: "url", id: "https://fig.io/" },
  { type: "url", id: "https://iterm2.com/" },
  { type: "url", id: "https://hyper.is/" },
  { type: "url", id: "https://www.alacritty.org/" },
  { type: "url", id: "https://wezterm.org/" },
  { type: "url", id: "https://ghostty.org/" },
  { type: "url", id: "https://www.kitty.dev/" },
  { type: "url", id: "https://tmux.github.io/" },
  { type: "url", id: "https://github.com/ohmyzsh/ohmyzsh" },
  { type: "url", id: "https://starship.rs/" },
  { type: "url", id: "https://github.com/nvm-sh/nvm" },
  { type: "url", id: "https://github.com/pyenv/pyenv" },
  { type: "url", id: "https://github.com/rbenv/rbenv" },
  { type: "url", id: "https://github.com/asdf-vm/asdf" },
  { type: "url", id: "https://brew.sh/" },
  { type: "url", id: "https://docs.brew.sh/" },
  { type: "url", id: "https://www.macports.org/" },
  { type: "url", id: "https://nixos.org/" },
  { type: "url", id: "https://guix.gnu.org/" },
  { type: "url", id: "https://www.debian.org/" },
  { type: "url", id: "https://ubuntu.com/" },
  { type: "url", id: "https://fedoraproject.org/" },
  { type: "url", id: "https://archlinux.org/" },
  { type: "url", id: "https://www.alpinelinux.org/" },
  { type: "url", id: "https://www.freebsd.org/" },
  { type: "url", id: "https://www.openbsd.org/" },
  { type: "url", id: "https://www.netbsd.org/" },
  { type: "url", id: "https://www.apple.com/macos/" },
  { type: "url", id: "https://www.microsoft.com/windows/" },
  { type: "url", id: "https://www.android.com/" },
  { type: "url", id: "https://www.apple.com/ios/" },
  { type: "url", id: "https://www.apple.com/ipados/" },
  { type: "url", id: "https://www.apple.com/watchos/" },
  { type: "url", id: "https://www.apple.com/tvos/" },
  { type: "url", id: "https://www.apple.com/visionos/" },
  { type: "url", id: "https://www.apple.com/macos/sonoma/" },
  { type: "url", id: "https://www.apple.com/macos/ventura/" },
  { type: "url", id: "https://www.apple.com/macos/monterey/" },
  { type: "url", id: "https://www.apple.com/macos/big-sur/" },
  { type: "url", id: "https://www.apple.com/macos/catalina/" },
  { type: "url", id: "https://www.apple.com/macos/mojave/" },
  { type: "url", id: "https://www.apple.com/macos/high-sierra/" },
  { type: "url", id: "https://www.apple.com/macos/sierra/" },
  { type: "url", id: "https://www.apple.com/macos/el-capitan/" },
  { type: "url", id: "https://www.apple.com/macos/yosemite/" },
  { type: "url", id: "https://www.apple.com/macos/mavericks/" },
  { type: "url", id: "https://www.apple.com/macos/mountain-lion/" },
  { type: "url", id: "https://www.apple.com/macos/lion/" },
  { type: "url", id: "https://www.apple.com/macos/snow-leopard/" },
  { type: "url", id: "https://www.apple.com/macos/leopard/" },
  { type: "url", id: "https://www.apple.com/macos/tiger/" },
  { type: "url", id: "https://www.apple.com/macos/panther/" },
  { type: "url", id: "https://www.apple.com/macos/jaguar/" },
  { type: "url", id: "https://www.apple.com/macos/puma/" },
  { type: "url", id: "https://www.apple.com/macos/cheetah/" },
];

const seen = new Set();
const POOL = SOURCE_POOL.filter((s) => {
  const key = `${s.type}:${s.id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

function shuffle(arr, seed = Date.now()) {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let count = 100;
  let concurrency = 6;
  let seed = Date.now();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") count = Number(args[++i]);
    else if (args[i] === "--concurrency") concurrency = Number(args[++i]);
    else if (args[i] === "--seed") seed = Number(args[++i]);
  }
  return { count, concurrency, seed };
}

async function prepareInput(source, workDir) {
  const inputDir = path.join(workDir, "input");
  const outputDir = path.join(workDir, "output");
  await mkdir(inputDir, { recursive: true });

  if (source.type === "repo") {
    await cloneRepo(source.id, inputDir, { timeoutMs: 90_000 });
    return { inputDir, outputDir, fetchMethod: "git-clone" };
  }

  const capture = await fetchPageForTransform(source.id, inputDir);
  if (capture.status !== "captured") {
    throw new Error(capture.error || `URL capture failed (${capture.status})`);
  }
  return { inputDir, outputDir, fetchMethod: capture.method ?? "fetch" };
}

async function runOne(source, index) {
  const workDir = path.join(RUNS_DIR, `run-${String(index).padStart(3, "0")}`);
  const started = Date.now();
  const result = {
    index,
    type: source.type,
    input: source.id,
    success: false,
    stage: null,
    error: null,
    durationMs: 0,
    fetchMethod: null,
    beforeScore: null,
    afterScore: null,
    scoreDelta: null,
    verdict: null,
    preserved: false,
    profile: null,
    archetype: null,
    brand: null,
    patternCount: null,
    topFindingsBefore: [],
    topFindingsAfter: [],
    outputFiles: []
  };

  try {
    const { inputDir, outputDir, fetchMethod } = await prepareInput(source, workDir);
    result.fetchMethod = fetchMethod;
    result.stage = "transform";

    const receipt = await transformSite(inputDir, outputDir);
    result.success = true;
    result.beforeScore = receipt.before?.score ?? null;
    result.afterScore = receipt.after?.score ?? null;
    result.scoreDelta = result.afterScore - result.beforeScore;
    result.verdict = receipt.verdict ?? null;
    result.preserved = receipt.preserved === true || receipt.mode === "preserve";
    result.profile = receipt.profile?.id ?? receipt.profile?.name ?? null;
    result.archetype = receipt.archetype?.id ?? receipt.archetype?.name ?? null;
    result.brand = receipt.content?.brand ?? null;
    result.patternCount = receipt.patterns?.length ?? null;
    result.topFindingsBefore = (receipt.before?.findings ?? []).slice(0, 5).map((f) => f.id);
    result.topFindingsAfter = (receipt.after?.findings ?? []).slice(0, 5).map((f) => f.id);
    result.outputFiles = receipt.output?.files ?? [];

    const sampleDir = path.join(workDir, "sample");
    await mkdir(sampleDir, { recursive: true });
    const outHtml = path.join(outputDir, "index.html");
    if (existsSync(outHtml)) {
      const html = await readFile(outHtml, "utf8");
      await writeFile(path.join(sampleDir, "index.html"), html.slice(0, 8000));
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.stage = result.stage ?? inferStage(error);
  } finally {
    result.durationMs = Date.now() - started;
  }

  return result;
}

function inferStage(error) {
  const msg = error instanceof Error ? error.message : String(error);
  if (/git clone|clone failed|timed out/i.test(msg)) return "clone";
  if (/fetch|capture|playwright|url/i.test(msg)) return "fetch";
  if (/html entry|No HTML/i.test(msg)) return "no-html";
  return "transform";
}

async function runPool(sources, concurrency) {
  const results = new Array(sources.length);
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const i = cursor++;
      const source = sources[i];
      process.stderr.write(`[${i + 1}/${sources.length}] ${source.type} ${source.id}\n`);
      results[i] = await runOne(source, i + 1);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function summarize(results) {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const durations = results.map((r) => r.durationMs);
  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  const scoreDeltas = successes.filter((r) => r.scoreDelta != null).map((r) => r.scoreDelta);

  const stageCounts = {};
  for (const f of failures) {
    stageCounts[f.stage] = (stageCounts[f.stage] ?? 0) + 1;
  }

  const errorCounts = {};
  for (const f of failures) {
    const key = (f.error ?? "unknown").slice(0, 120);
    errorCounts[key] = (errorCounts[key] ?? 0) + 1;
  }

  const profileCounts = {};
  for (const s of successes) {
    if (s.profile) profileCounts[s.profile] = (profileCounts[s.profile] ?? 0) + 1;
  }

  return {
    total: results.length,
    successCount: successes.length,
    failureCount: failures.length,
    successRate: successes.length / results.length,
    avgDurationMs: Math.round(avgMs),
    medianDurationMs: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)],
    avgScoreDelta: scoreDeltas.length ? Math.round(scoreDeltas.reduce((a, b) => a + b, 0) / scoreDeltas.length * 10) / 10 : null,
    preservedCount: successes.filter((r) => r.preserved).length,
    repoCount: results.filter((r) => r.type === "repo").length,
    urlCount: results.filter((r) => r.type === "url").length,
    repoSuccessRate: results.filter((r) => r.type === "repo" && r.success).length / Math.max(1, results.filter((r) => r.type === "repo").length),
    urlSuccessRate: results.filter((r) => r.type === "url" && r.success).length / Math.max(1, results.filter((r) => r.type === "url").length),
    failureStages: stageCounts,
    topErrors: Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 15),
    profileDistribution: Object.entries(profileCounts).sort((a, b) => b[1] - a[1])
  };
}

function pickSamples(results) {
  const ok = results.filter((r) => r.success && r.scoreDelta != null);
  const best = [...ok].sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 5);
  const worst = [...ok].sort((a, b) => a.scoreDelta - b.scoreDelta).slice(0, 5);
  const preserved = ok.filter((r) => r.preserved).slice(0, 3);
  const failed = results.filter((r) => !r.success).slice(0, 10);
  return { best, worst, preserved, failed };
}

async function main() {
  const { count, concurrency, seed } = parseArgs();
  const selected = shuffle(POOL, seed).slice(0, Math.min(count, POOL.length));

  if (selected.length < count) {
    console.error(`Warning: pool has ${POOL.length} unique sources, running ${selected.length}.`);
  }

  await rm(RUNS_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(RUNS_DIR, { recursive: true });

  console.error(`Running ${selected.length} transforms (concurrency=${concurrency}, seed=${seed}, pool=${POOL.length})…`);
  const started = Date.now();
  const results = await runPool(selected, concurrency);
  const summary = summarize(results);
  const samples = pickSamples(results);

  const report = {
    schemaVersion: "morph.batch-test.v1",
    generatedAt: new Date().toISOString(),
    seed,
    concurrency,
    poolSize: POOL.length,
    totalDurationMs: Date.now() - started,
    summary,
    samples,
    results
  };

  const reportPath = path.join(OUT_DIR, `batch-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

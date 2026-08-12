# Publishing the SEISMIC Earthquake Simulator

This project is configured as a standard **Next.js application for Vercel**. The recommended workflow is to push the `main` branch to GitHub and import that repository into Vercel.

## 1. Verify the project before publishing

From the project directory, run:

```bash
npm install
npm test
npm run lint
```

Publish only when the tests and lint checks finish successfully. The build may display a non-blocking warning about the Three.js bundle size; that warning does not prevent deployment.

For a final local review:

```bash
npm run dev
```

Then open the local address printed by the command, normally `http://localhost:3000`.

Check the following before going live:

- The launch image appears and fades into the simulator.
- Ground-motion and structure controls update the results.
- Every structure type renders, including the occupied multi-story car park.
- Zoom, playback, restart, and report download work.
- The Help Center, walkthrough spotlights, and LinkedIn link work.
- The regional map switches between its area overview and keyless 3D OpenStreetMap building view.
- The layout remains usable on a phone and desktop.
- The engineering and liability disclaimer appears in the interface and downloaded report.

## 2. Save the release in Git

Git is already initialized with `main` as the current branch. Create the first saved version with:

```bash
git add .
git commit -m "Initial SEISMIC simulator release"
```

Before committing, use `git status` to confirm that no private files or credentials are included. Environment files are ignored by the existing `.gitignore`.

### Optional: back up the source on GitHub

Create an empty GitHub repository without a README or `.gitignore`, then connect and push this project:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

GitHub stores the source code; it does not publish this particular application by itself.

## 3. Publish with Vercel

1. Sign in at `https://vercel.com` using the Git provider that owns the repository.
2. Select **Add New > Project** and import the repository.
3. Confirm the framework preset is **Next.js** and the root directory is the repository root.
4. Select **Deploy**. No environment variables or map credentials are required.

Vercel will use `npm ci` followed by `npm run build`. Pushes to `main` become production deployments; other branches produce preview deployments.

## 4. Smoke-test the live site

On the deployed URL, verify:

1. The landing artwork loads successfully.
2. The Three.js model appears and responds to orbit and zoom.
3. Changing magnitude, intensity, amplitude, frequency, site class, structure, and floors updates the analysis.
4. The Regional Map opens, city/radius settings update results, clicking the map moves the epicenter, and the 3D District control extrudes nearby OpenStreetMap buildings.
5. The complete walkthrough advances through all five highlighted steps.
6. The PDF report downloads and includes the professional-use disclaimer.
7. The LinkedIn contact link opens `https://www.linkedin.com/in/diego-avella/`.
8. The page works in both a desktop window and a phone-sized viewport.

## 5. Publish future updates

After making and validating a change:

```bash
npm test
npm run lint
git add .
git commit -m "Describe the update"
```

Push the commit to `main`; the connected Vercel project deploys it automatically. Keep each release in Git so a previous working version can be identified or redeployed if a later update needs to be rolled back.

## Important operating note

The simulator is an educational, simplified response model. Its website and generated reports must continue to state that they do not replace analysis, inspection, code review, or professional judgment by a licensed structural or civil engineer.

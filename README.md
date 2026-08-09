# WayPoint Planner

Build a polished full-stack AI travel planning platform called "WayPoint".




IMPORTANT:

This is an AI/ML hackathon project, so the AI should be the core of the product. Do NOT make this a basic chatbot. The platform should behave like an agentic travel-planning system that takes a user's goals and constraints, reasons through them, creates a plan, checks the plan for conflicts, and produces a personalized vacation guide.




TECH STACK:

- Next.js / React with TypeScript

- Modern responsive UI

- Tailwind CSS

- Supabase for authentication, database, and user data

- Server-side/Edge Functions for AI calls

- Use environment variables for all API keys

- Never expose API keys in client-side code

- Structure the code so an LLM API can be connected through a secure server-side endpoint

- If a real external travel API is unavailable, create clean mock/service interfaces rather than hardcoding fake claims




CORE USER FLOW:




1. LANDING PAGE




Create a beautiful modern landing page with:




"Plan a trip that actually fits YOU."




Subtitle:

"WayPoint uses AI agents to build personalized travel plans around your budget, interests, schedule, accessibility needs, and travel style."




CTA:

"Plan My Trip"




Include a simple visual showing:

User Preferences → AI Travel Agent → Personalized Vacation Guide




Do not make the landing page overly complicated.




2. TRIP PLANNER FORM




Create a multi-step form that collects:




DESTINATION

- Where do you want to go?

- Allow users to enter a specific destination OR select "I'm flexible"

- If flexible, ask what region/country/world area they prefer.




DATES

- Vacation start date

- Vacation end date

- OR number of days




BUDGET

- Total budget

- Currency

- Budget flexibility

- Approximate budget category:

  Budget / Moderate / Comfortable / Luxury




TRAVELERS

- Number of travelers

- Adults

- Children

- Optional ages of children




TRAVEL STYLE

Allow multiple selections:

- Relaxing

- Adventure

- Food

- Culture

- History

- Nature

- Nightlife

- Shopping

- Beaches

- Photography

- Sports

- Family-friendly

- Romantic

- Educational




PREFERENCES

Allow the user to describe anything else they want.




Examples:

"I want lots of local food."

"I don't like crowded tourist attractions."

"I want to wake up late."

"I want a mix of museums and outdoor activities."




ACCESSIBILITY & HEALTH-RELATED TRAVEL NEEDS

Include an optional accessibility section.




Ask about:

- Wheelchair accessibility

- Limited walking

- Mobility assistance

- Avoid stairs

- Hearing accessibility

- Visual accessibility

- Sensory considerations

- Dietary restrictions/allergies

- Medication/storage considerations

- Other accessibility needs




IMPORTANT:

Treat these as travel-planning constraints, not medical advice.

Never make assumptions about a person's disability.

Allow the user to skip this section.




PACE:

- Relaxed

- Balanced

- Packed




ACCOMMODATION:

- Hotel

- Hostel

- Vacation rental

- Resort

- Flexible

- Accessibility requirements




TRANSPORTATION:

- Public transportation

- Walking

- Rental car

- Taxi/rideshare

- Flexible




3. AI TRAVEL AGENT




After the user submits the form, show an "AI Travel Agent" planning screen.




Instead of immediately showing the final answer, show the agent working through several stages:




STEP 1 — Understand

"Analyzing your preferences..."




STEP 2 — Plan

"Building destinations and activities around your constraints..."




STEP 3 — Optimize

"Balancing budget, travel time, accessibility, and interests..."




STEP 4 — Check

"Checking your itinerary for conflicts and unrealistic scheduling..."




STEP 5 — Finalize

"Creating your personalized travel guide..."




This should feel like an agentic workflow.




Use a structured internal planning process.




The AI should:

- Extract user constraints

- Identify priorities

- Generate candidate activities/destinations

- Rank them according to user preferences

- Consider budget

- Consider trip duration

- Consider accessibility constraints

- Consider travel time

- Avoid scheduling too many activities in one day

- Respect the requested pace

- Detect conflicts

- Revise the itinerary if necessary

- Produce a final structured guide




Do NOT simply ask the model to "write a travel itinerary."




Use a structured JSON response internally whenever possible.




4. PERSONALIZED TRAVEL GUIDE




After planning, display a beautiful results dashboard.




HEADER:

Destination

Dates

Number of travelers

Estimated total budget




Then show:




TRIP OVERVIEW

A short explanation of why this itinerary matches the user's preferences.




BUDGET BREAKDOWN

Show estimated:

- Accommodation

- Food

- Transportation

- Activities

- Miscellaneous

- Total




Clearly label estimates as estimates.




ITINERARY




For each day:




DAY 1 — [Theme]




Morning

- Activity

- Approximate duration

- Estimated cost

- Why it fits the user




Afternoon

- Activity

- Duration

- Cost




Evening

- Activity

- Duration

- Cost




Include:

- Transportation suggestions

- Approximate travel time between activities

- Accessibility considerations when relevant

- Rest periods based on user's preferred pace




Do not schedule impossible travel times.




5. "WHY THIS WAS CHOSEN"




For each major recommendation, show a small explanation such as:




"Chosen because you prioritized food + culture and wanted to avoid crowded tourist attractions."




This is important because it demonstrates AI personalization.




6. AI ADAPTATION




Add buttons:




"Make it cheaper"

"Make it more relaxing"

"Add more adventure"

"More food"

"More culture"

"Less walking"

"Make it family-friendly"

"Change my destination"

"Regenerate"




When clicked, the AI should modify the existing itinerary rather than starting from zero.




For example:

User clicks "Make it cheaper"




AI should preserve the user's important preferences while reducing estimated costs.




7. AGENTIC "TRIP CHECK"




Add a section called:




"AI Trip Check"




The AI evaluates the itinerary for:




✓ Budget consistency

✓ Time feasibility

✓ Travel distance

✓ Accessibility compatibility

✓ Pace

✓ Preference matching

✓ Scheduling conflicts




Display a simple score:




Trip Fit: 92/100




Then show:

"Your trip is well balanced. The only potential issue is Day 3, which has a longer travel period."




If a conflict exists, the AI should propose a correction.




8. SAVED TRIPS




Use Supabase to allow authenticated users to save generated trips.




Dashboard:

- New Trip

- My Trips

- View previous trips

- Delete trip




Each saved trip should store:

- User preferences

- Destination

- Dates

- Itinerary

- Budget

- AI reasoning/fit information

- Created date




9. AUTHENTICATION




Implement:

- Sign up

- Login

- Logout

- Protected dashboard

- Supabase authentication




Do not require login to try the planner initially if possible.

Allow users to generate one trip as a guest, then encourage them to save it by creating an account.




10. DATABASE




Create appropriate Supabase tables such as:




profiles

trips

trip_preferences

itinerary_days

itinerary_items




Use proper relationships and Row Level Security so users can only access their own saved trips.




11. UI/UX




Design should feel like a premium modern travel-tech startup.




Use:

- Clean typography

- Large destination imagery where appropriate

- Rounded cards

- Subtle animations

- Responsive layout

- Clear hierarchy

- Modern dashboard

- Progress indicators

- Loading states

- Empty states

- Error states




Use a sophisticated travel aesthetic without making it look like a generic AI chatbot.




The primary interface should feel like:

"AI travel operating system"




rather than:

"Chat with an AI."




12. IMPORTANT AI SAFETY / ACCURACY




The AI must NOT present estimated prices, opening hours, transportation schedules, accessibility information, or availability as confirmed facts unless retrieved from a verified external source.




Clearly distinguish:

- Estimated information

- User-provided information

- Verified external information




If live travel data APIs are not connected, display:

"Estimated — verify before booking."




For accessibility:

Never guarantee that a location is accessible unless verified.

Use language such as:

"Reported/estimated accessibility — confirm directly with the venue."




Do not provide medical advice.




13. ARCHITECTURE




Organize the application so the AI system can later support multiple specialized agents.




Create a conceptual agent architecture:




ORCHESTRATOR AGENT

↓

Preference Analyzer

↓

Destination/Activity Planner

↓

Budget Agent

↓

Accessibility Agent

↓

Schedule Optimizer

↓

Trip Critic

↓

Final Itinerary Generator




For the MVP, these can use the same underlying LLM but should be separated into logical server-side functions/modules.




The Orchestrator should coordinate the process.




Example:




User Input

↓

Preference Analyzer

↓

Planner

↓

Budget Check

↓

Accessibility Check

↓

Schedule Check

↓

Critic

↓

Revision if needed

↓

Final Guide




14. DEMO MODE




Because this is a hackathon project, include a "Try Demo Trip" button.




Example demo:

Destination: Tokyo

Length: 6 days

Budget: $2,500

Travelers: 2

Preferences: Food, culture, photography

Pace: Balanced

Accessibility: Limited walking




Clicking it should populate the form with demo data so I can quickly demonstrate the app.




15. ERROR HANDLING




If the AI fails:

- Show a friendly error

- Allow retry

- Do not lose the user's form data




If an API is unavailable:

- Gracefully fall back to clearly labeled estimated/mock data

- Never pretend mock data is real-time verified data




16. FINAL POLISH




Make the app feel like a real startup/hackathon-winning product.




Add:

- "AI-generated" labels where appropriate

- Agent progress animation

- Trip Fit score

- Budget visualization

- Personalized recommendation explanations

- Smooth transitions

- Mobile responsiveness




Most importantly:




DO NOT build a generic chatbot.




The defining feature of WayPoint is:




"Tell us what YOU need. Our AI agents figure out how to build the trip around you."




Build the complete working full-stack MVP, including frontend, backend/server functions, Supabase schema, authentication, AI integration architecture, responsive UI, and agentic planning workflow.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://waypointtravels.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/df6a02c0-1b65-4fa8-a94a-81348741dbef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

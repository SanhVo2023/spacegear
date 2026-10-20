import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
export const metadata = buildMetadata({title:"Our Approach",description:"Assess, prioritize, validate, deliver and adopt. A practical approach to digital transformation and AI implementation with clear decisions and handover.",path:"/approach/"});
const stages = [
  ["Assess", "Understand the work.", "Map the current workflow, systems, constraints and people involved. Agree the problem before choosing a solution.", "Current-state map and problem definition"],
  ["Prioritize", "Choose a useful next step.", "Compare opportunities by value, feasibility and dependencies. Agree a baseline and what success would mean.", "Opportunity shortlist and delivery roadmap"],
  ["Validate", "Test the important assumptions.", "Use a prototype or a focused pilot to evaluate the approach. Compare results with a baseline and decide what deserves further investment.", "Evaluation evidence and a clear go/no-go decision"],
  ["Deliver", "Build around the real workflow.", "Design and engineer in reviewable increments. Test integrations, exceptions and the user experience before rollout.", "Tested implementation and rollout plan"],
  ["Adopt", "Prepare for everyday use.", "Document operation and ownership, support the handover and agree how to measure and improve the system.", "Operating guidance and improvement backlog"]
];
export default function Approach() {
  return <main id="main"><PageIntro eyebrow="How we work" title="A clear path from intention to implementation." description="Useful deliverables, visible decisions and a shared understanding of what comes next. The depth of each stage follows the engagement."/>
    <div className="site-container service-index">{stages.map(([name,title,text,output],i)=><article className="service-index-card" key={name}><div><p className="eyebrow">{name}</p><h2>{title}</h2><p>{text}</p><p className="process-output">You receive: {output}</p></div><span className="service-index-no">0{i+1}</span></article>)}</div>
  </main>;
}

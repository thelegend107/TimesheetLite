import { projectColor } from "../lib/projects";

function ProjectDot({ project }: { project: string }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: projectColor(project) }} />;
}

export function ProjectLabel({ project, className = "max-w-64" }: { project: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <ProjectDot project={project} />
      <span className="truncate">{project}</span>
    </span>
  );
}

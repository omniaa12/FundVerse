import React from "react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  title: string;
  description: string;
}

interface ProjectsListProps {
  projects: Project[];
}

const ProjectsList: React.FC<ProjectsListProps> = ({ projects }) => {
  const navigate = useNavigate();

  const handleNavigate = (id: string) => {
    navigate(`/project/${id}`);
  };

  return (
    <div className="projects-list grid grid-cols-1 md:grid-cols-2 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white shadow-lg rounded-2xl p-4 flex flex-col justify-between"
        >
          <div>
            <h2 className="text-xl font-semibold">{project.title}</h2>
            <p className="text-gray-600">{project.description}</p>
          </div>

          <button
            onClick={() => handleNavigate(project.id)}
            className="mt-4 ml-auto bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center justify-center"
          >
            ➝
          </button>
        </div>
      ))}
    </div>
  );
};

export default ProjectsList;
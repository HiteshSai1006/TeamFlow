import * as projectService from './project.service.js';

export async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    const project = await projectService.createProject({
      name,
      description,
      createdById: req.user.id
    });

    return res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const projects = await projectService.getProjectsForUser(req.user.id);
    return res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    // req.project and req.projectMember are attached by requireProjectRole middleware
    return res.status(200).json({
      success: true,
      project: req.project,
      role: req.projectMember.role
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const project = await projectService.updateProject(projectId, req.body);
    return res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
}

export async function archive(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const project = await projectService.archiveProject(projectId);
    return res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
}

export async function restore(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const project = await projectService.restoreProject(projectId);
    return res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
}

export async function listMembers(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const members = await projectService.getProjectMembers(projectId);
    return res.status(200).json({
      success: true,
      members
    });
  } catch (error) {
    next(error);
  }
}

export async function inviteMember(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { email, role } = req.body;
    const member = await projectService.addProjectMember(projectId, email, role);
    return res.status(201).json({
      success: true,
      member
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const memberId = parseInt(req.params.memberId, 10);
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: 'Role parameter is required.'
      });
    }

    const member = await projectService.updateProjectMemberRole(projectId, memberId, role, req.user.id);
    return res.status(200).json({
      success: true,
      member
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const memberId = parseInt(req.params.memberId, 10);
    await projectService.removeProjectMember(projectId, memberId, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Member removed successfully.'
    });
  } catch (error) {
    next(error);
  }
}


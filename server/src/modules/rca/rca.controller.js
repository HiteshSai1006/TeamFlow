import * as rcaService from './rca.service.js';

export async function create(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { title, description, severity } = req.body;
    const actorUserId = req.user.id;

    const rca = await rcaService.createRCA(projectId, { title, description, severity }, actorUserId);

    return res.status(201).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcas = await rcaService.listRCAs(projectId);

    return res.status(200).json({
      success: true,
      rcas
    });
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);

    const rca = await rcaService.getRCA(projectId, rcaId);

    return res.status(200).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

export async function patch(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);
    const { title, description, severity } = req.body;
    const actorUserId = req.user.id;
    const actorRole = req.projectMember.role;

    const rca = await rcaService.patchRCA(projectId, rcaId, { title, description, severity }, actorUserId, actorRole);

    return res.status(200).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

export async function upsertSection(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);
    const { sectionType } = req.params;
    const { content } = req.body;
    const actorUserId = req.user.id;
    const actorRole = req.projectMember.role;

    const section = await rcaService.upsertSection(projectId, rcaId, sectionType, { content }, actorUserId, actorRole);

    return res.status(200).json({
      success: true,
      section
    });
  } catch (error) {
    next(error);
  }
}

export async function submit(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);
    const { reviewerIds } = req.body;
    const actorUserId = req.user.id;
    const actorRole = req.projectMember.role;

    const rca = await rcaService.submitRCA(projectId, rcaId, { reviewerIds }, actorUserId, actorRole);

    return res.status(200).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

export async function reopen(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);
    const actorUserId = req.user.id;
    const actorRole = req.projectMember.role;

    const rca = await rcaService.reopenRCA(projectId, rcaId, actorUserId, actorRole);

    return res.status(200).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

export async function close(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rcaId = parseInt(req.params.rcaId, 10);
    const actorUserId = req.user.id;
    const actorRole = req.projectMember.role;

    const rca = await rcaService.closeRCA(projectId, rcaId, actorUserId, actorRole);

    return res.status(200).json({
      success: true,
      rca
    });
  } catch (error) {
    next(error);
  }
}

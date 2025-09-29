class BaseController {
    static addOrganizationFilter(query, params, user) {
        const orgParam = params.length + 1;
        params.push(user.organizationId);

        if (query.toLowerCase().includes('where')) {
            return query.replace(/WHERE/i, `WHERE organization_id = $${orgParam} AND `);
        } else {
            return query + ` WHERE organization_id = $${orgParam}`;
        }
    }

    static addTeamFilter(query, params, user) {
        if (user.role === 'admin') return query; // Admins see all teams

        const teamParam = params.length + 1;
        params.push(user.teamId);

        if (query.toLowerCase().includes('where')) {
            return query + ` AND team_id = $${teamParam}`;
        } else {
            return query + ` WHERE team_id = $${teamParam}`;
        }
    }

    static validateOwnership(resourceOwnerId, userId, role = null) {
        if (role === 'admin') return true;
        return resourceOwnerId === userId;
    }
}

module.exports = BaseController;
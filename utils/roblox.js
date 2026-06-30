const BASE = {
  users:      'https://users.roblox.com/v1',
  friends:    'https://friends.roblox.com/v1',
  thumbnails: 'https://thumbnails.roblox.com/v1',
  groups:     'https://groups.roblox.com/v1',
};

async function apiFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveUsername(username) {
  try {
    const res = await fetch(`${BASE.users}/usernames/users`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getUserById(userId) {
  return apiFetch(`${BASE.users}/users/${userId}`);
}

async function getAvatarUrl(userId) {
  const data = await apiFetch(
    `${BASE.thumbnails}/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );
  return data?.data?.[0]?.imageUrl ?? null;
}

async function getFriendsCount(userId) {
  const data = await apiFetch(`${BASE.friends}/users/${userId}/friends/count`);
  return data?.count ?? 0;
}

async function getFollowersCount(userId) {
  const data = await apiFetch(`${BASE.friends}/users/${userId}/followers/count`);
  return data?.count ?? 0;
}

async function getUserGroups(userId) {
  const data = await apiFetch(`${BASE.groups}/users/${userId}/groups/roles`);
  return data?.data ?? [];
}

async function quickProfile(username) {
  const resolved = await resolveUsername(username);
  if (!resolved) return null;

  const userId = String(resolved.id);
  const [profile, avatarUrl, friendsCount, followersCount, groups] = await Promise.all([
    getUserById(userId),
    getAvatarUrl(userId),
    getFriendsCount(userId),
    getFollowersCount(userId),
    getUserGroups(userId),
  ]);

  if (!profile) return null;

  return {
    roblox_id:      userId,
    username:       profile.name,
    display_name:   profile.displayName,
    description:    profile.description || '',
    is_banned:      profile.isBanned || false,
    created:        profile.created,
    avatar_url:     avatarUrl,
    friends_count:  friendsCount,
    followers_count: followersCount,
    groups,
  };
}

module.exports = { quickProfile, resolveUsername, getUserById, getAvatarUrl };

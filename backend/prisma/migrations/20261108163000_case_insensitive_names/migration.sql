-- Usernames / player names are unique case-insensitively ("Bob" blocks "bob").
-- Prisma cannot express expression indexes, so this migration is hand-written.
CREATE UNIQUE INDEX "User_username_lower_key" ON "User"(lower("username"));
CREATE UNIQUE INDEX "Player_name_lower_key" ON "Player"(lower("name"));

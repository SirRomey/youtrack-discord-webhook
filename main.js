const entities = require("@jetbrains/youtrack-scripting-api/entities");

const CONFIG = require("./config");
const COLORS = require("./config_colors");
const { Payload } = require("./payload");
const { EVENTS } = require("./config_events");
const { Embed, Body, Author, Field, Footer } = require("./embed");

exports.rule = entities.Issue.onChange({
    title: "Discord Webhook",
    guard: (ctx) => {
        return ctx.issue.isReported;
    },
    action: (ctx) => {
        const issue = ctx.issue;
        const user = ctx.currentUser;

        let changes = [];

        for (let i = 0; i < EVENTS.length; i++) {
            const event = EVENTS[i];
            const issueKey = event.issueKey;
            if (!((issueKey && issue.fields[issueKey] && issue.isChanged(issueKey)) || (event.customCheck && event.customCheck(issue)))) continue;

            let oldValue;
            let newValue;

            if (issueKey) {
                oldValue = issue.oldValue(issueKey);
                newValue = issue.fields[issueKey];
            }

            if (event.valueGetter) newValue = event.valueGetter(issue);

            if (event.mention) {
                oldValue = oldValue ? "<@" + oldValue.getAttribute('Discord ID') + ">" : null;
                newValue = newValue ? "<@" + newValue.getAttribute('Discord ID') + ">" : null;
            }

            if (event.nameKey) {
                if (oldValue) oldValue = oldValue[event.nameKey];
                newValue = newValue[event.nameKey];
            }

            let description = oldValue ? event.changeDescription : event.newDescription;

            changes.push({
                title: event.title,
                description: description.replace("$oldValue", oldValue).replace("$newValue", newValue)
            });
        }

        const changeCount = changes.length;
        if (changeCount < 1) return;

        const payload = new Payload(null, CONFIG.SENDER_NAME, CONFIG.AVATAR_URL);
        const embed = new Embed();
        const body = new Body();

        if (changeCount === 1) {
            const change = changes[0];
            body.title = change.title + " [" + issue.id + "]\n" + issue.summary
            body.description = change.description;
        }
        else {
            body.title = changeCount + " New Changes To " + issue.id;
            for (let i = 0; i < changes.length; i++) embed.addField(new Field(changes[i].title, changes[i].description, false));
        }

        body.url = issue.url;
        body.color = COLORS.COLOR_REGULAR;
        body.setDateToNow();

        let webhooks = [];

        if (CONFIG.WEBHOOK_URL) webhooks.push(CONFIG.WEBHOOK_URL);

        // Notify all watchers
        var mentions = "";
        issue.tags.forEach(function (tag) {
            if (tag.name == "Star") {
                var watcherUsername = tag.owner;
                mentions += "<@" + watcherUsername.attributes['Discord ID'] + "> " + "\n";
            }
        });

        if (mentions.length > 0) {
            embed.addField(new Field("Watchers", mentions, false));
        }

        embed.body = body;
        embed.author = new Author(user.visibleName, CONFIG.YOUTRACK_URL + "/users/" + user.login, user.avatarUrl);
        embed.footer = new Footer(CONFIG.SITE_NAME + " " + issue.project.name);

        payload.addEmbed(embed);

        webhooks.forEach(function (url) {
            payload.send(url);
        });
    }
});

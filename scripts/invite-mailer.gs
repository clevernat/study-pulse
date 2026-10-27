// StudyPulse invite mailer — a Google Apps Script web app that sends invite
// emails from your own Gmail (free, up to 100 a day).
//
// Setup (once):
//   1. Open https://script.google.com and click "New project".
//   2. Delete what is there, paste this whole file, click Save.
//   3. Deploy > New deployment > type "Web app".
//      Execute as: Me.  Who has access: Anyone.  Click Deploy, then Authorize.
//   4. Copy the "Web app URL" (ends in /exec) and give it to Claude.
//
// Only a signed-in StudyPulse admin can make it send, and only to an email
// that is already on the invite list. The link in the email always points to
// one of SITES below, never to an address the caller chooses.

var PROJECT = "studypulse-tracker-app";
var SITES = [
  "https://studypulse-tracker-app.web.app",
  "https://studypulse-tracker-app--preview-sa50d1sl.web.app",
];
var FIRESTORE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var token = String(body.idToken || "");
    var email = String(body.email || "").trim().toLowerCase();
    var site = SITES.indexOf(body.site) >= 0 ? body.site : SITES[0];

    // The token's uid. Firestore checks the token itself on the next call,
    // and its rules only let you read your own member document.
    var uid = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split(".")[1])).getDataAsString()).user_id;
    var me = read("members/" + uid, token);
    if (!me || field(me, "role") !== "admin") return reply({ ok: false, error: "not-admin" });

    var invite = read("invites/" + encodeURIComponent(email), token);
    if (!invite) return reply({ ok: false, error: "no-invite" });

    var role = field(invite, "role") === "admin" ? "an admin" : "a member";
    var from = field(me, "name") || "Your StudyPulse admin";
    var link = site + "/login/?mode=signup&email=" + encodeURIComponent(email);
    MailApp.sendEmail({
      to: email,
      name: "StudyPulse",
      subject: from + " invited you to StudyPulse",
      htmlBody: html(from, role, email, link, site),
      body: from + " invited you to StudyPulse as " + role + ".\n\nJoin here: " + link +
        "\n\nUse this email (" + email + "): click \"Continue with Google\", or sign up with a username and password.",
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function read(path, token) {
  var res = UrlFetchApp.fetch(FIRESTORE + path, { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
  return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null;
}

function field(doc, name) {
  var f = doc.fields && doc.fields[name];
  return f ? f.stringValue : "";
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
}

function html(from, role, email, link, site) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1f">' +
    '<h1 style="font-size:24px;margin:0 0 4px">Study<span style="color:#5e6ad2">Pulse</span></h1>' +
    '<p style="font-size:16px">' + esc(from) + ' invited you to join StudyPulse as ' + role + '.</p>' +
    '<p style="font-size:14px;color:#555">StudyPulse helps you plan your study, track your time and focus, and see your progress.</p>' +
    '<p style="margin:28px 0"><a href="' + esc(link) + '" style="background:#5e6ad2;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Join StudyPulse</a></p>' +
    '<p style="font-size:13px;color:#555">Use this email: <b>' + esc(email) + '</b>. Click "Continue with Google", or sign up with a username and password.</p>' +
    '<p style="font-size:12px;color:#888">If the button does not work, open ' + esc(site) + '/login</p></div>';
}

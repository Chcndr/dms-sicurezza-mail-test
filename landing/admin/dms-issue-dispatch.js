/*!
 * dms-issue-dispatch.js
 * Non cambia il design: chiama questa funzione dal bottone già esistente
 * esempio: openDispatchIssue('utente@example.com', tokenLink, 'DMS – Accesso', 'starttls')
 */
(function(){
  window.openDispatchIssue = function(to, tokenLink, subject, transport, html_extra){
    var owner='Chcndr', repo='dms-sicurezza-mail-test';
    var payload = '<!--DMS:START-->\n```json\n' + JSON.stringify({
      to: to,
      token_link: tokenLink,
      subject: subject || 'DMS – Accesso',
      transport: transport || 'smtps',
      html_extra: html_extra || ''
    }, null, 2) + '\n```\n<!--DMS:END-->';
    var url = 'https://github.com/'+owner+'/'+repo+'/issues/new'
      + '?labels=dispatch-email'
      + '&title=' + encodeURIComponent('DMS: Send Access Email')
      + '&body=' + encodeURIComponent(payload);
    window.open(url, '_blank');
  };
})();

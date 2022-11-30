// Requètes
module.exports = Object.freeze({
		reqTagHisto: `
      SELECT
			event_json.Date as eventDate,
			event_json.JSON AS ticket
      FROM
      event_json
      where
      JSon LIKE :tagId
      AND Type IN (:type)
      ORDER BY IDEvent DESC
      LIMIT :nb OFFSET :offset
    `,
		reqCheckPointHisto: `
			SELECT
			event_json.Date as eventDate,
			event_json.JSON AS ticket
			FROM
			event_json
			where
			left(date,10) = left(now(),10)
			ORDER BY IDEvent DESC
			LIMIT :nb OFFSET :offset
		`,
		reqNbPassageByDay:`
			SELECT
			MIN(Date) as eventDate,
			COUNT(left(Date,10)) as cpt
			FROM
			event_json
			where
			Type IN ('ok')
			group by left(Date,10)
			ORDER BY IDEvent DESC
			LIMIT :nb OFFSET :offset
		`,
		reqNbTagPassageByDay:`
			SELECT
			MIN(Date) as eventDate,
			COUNT(left(Date,10)) as cpt
			FROM
			event_json
			where
			JSon LIKE :tagId
      AND Type IN ('ok')
			group by left(Date,10)
			ORDER BY IDEvent DESC
			LIMIT :nb OFFSET :offset
		`,
});

---
date: "2022-09-09"
title: "SQL Refresh - Common Table Expressions"
category: "Development"
---

I started a new role where our system stores data in a PostgreSQL database. It has been some time since I have used SQL in anger, having worked on systems using NoSQL databases for the past 10 years or so. Whilst refreshing my SQL skills, I discovered some very useful features I have not used before that I will cover on this blog. The first of these is Common Table Expressions.

## Common Table Expressions (CTE)

While debugging I was reminded how ad-hoc queries can quickly grow in size and complexity with many sub queries to keep track of. My stock way of dealing with these was to be very careful with formatting and comment parts of the query to allow me to keep some sanity. That is until I saw a colleague using a CTE.

The following SQL query calculates the occupancy for flights (see https://postgrespro.com/docs/postgrespro/10/apjs02.html for the database schema)

```sql
SELECT
    f.flight_id, ROUND(CAST(f.passengers AS decimal)/c.capacity, 2) AS occupancy
FROM
    (
      /* number of passengers on flights */
        SELECT 
            f1.flight_id, f1.aircraft_code, count(*) AS passengers
        FROM
            flights f1
        INNER JOIN
            boarding_passes bp ON f1.flight_id = bp.flight_id
        GROUP BY
            f1.flight_id
    ) AS f
INNER JOIN
    (
      /* seating capacity of different aircraft */
        SELECT
            aircraft_code, count(*) AS capacity
        FROM
            seats
        GROUP BY
            aircraft_code
    ) AS c
    ON F.aircraft_code = c.aircraft_code;
```

Although a relatively simple example, it can be difficult to read due to the use of 2 sub queries.

Making use of Common Table Expressions, we can rewrite this as

```sql
WITH
    flight_passengers  AS (
        SELECT
            f.flight_id, f.aircraft_code, count(*) AS passengers
        FROM
            flights f
        INNER JOIN
            boarding_passes bp ON f.flight_id = bp.flight_id
        GROUP BY
            f.flight_id
    ),
    aircraft_capacity AS  (
        SELECT
            aircraft_code, count(*) AS capacity
        FROM
            seats
        GROUP BY
            aircraft_code
    )
  
SELECT
    p.flight_id, round(cast(p.passengers AS decimal)/c.capacity,2) AS occupancy
FROM
    flight_passengers p
INNER JOIN
    aircraft_capacity c ON p.aircraft_code = c.aircraft_code
```

This takes the same approach and allows me to clearly separate the subqueries, making it easier to understand each in isolation. These can then be combined in a simple select statement focussed on the occupancy calculation.

I think of CTEs as temporary views I can create to make complex SQL queries easier to read and understand.

There is more to CTE's, they can be more performant in some situations and you can use them to modify data. If you are interested in exploring further the documentation is here: https://www.postgresql.org/docs/current/queries-with.html

## Demo Database
For the examples I have used of the demo database available from: https://postgrespro.com/education/demodb

I used docker to run a postgresql server (14.5). My script to startup and load the database is:

```sh
curl https://edu.postgrespro.com/demo-small-en.zip
docker run -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
unzip demo-small-en.zip
psql -h localhost -f demo-small-en-20170815.sql -U postgres
```

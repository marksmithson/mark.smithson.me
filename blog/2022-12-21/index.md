---
date: "2022-12-21"
title: "SQL Refresh - Row Numbers and Ranks"
category: "Development"
---

### Window Functions Part 2

One of the most common uses for window functions is to return the first row for a partition. To demonstrate this we will find the first flight for each flight.

The `row_number` function returns the position of the row within a partition. This means we want to specify an ordering within the partition as below:

```sql
SELECT
    flight_id,
    flight_no,
    scheduled_departure,
    row_number() OVER (PARTITION BY flight_no ORDER BY scheduled_departure) AS row_number
  FROM
    flights
```

This returns the following:

| flight\_id | flight\_no | scheduled\_departure | row\_number |
| :--- | :--- | :--- | :--- |
| 20835 | PG0001 | 2017-07-22 12:15:00.000000 +00:00 | 1 |
| 20841 | PG0001 | 2017-07-29 12:15:00.000000 +00:00 | 2 |
| 20839 | PG0001 | 2017-08-05 12:15:00.000000 +00:00 | 3 |
| 20834 | PG0001 | 2017-08-12 12:15:00.000000 +00:00 | 4 |
| 20840 | PG0001 | 2017-08-19 12:15:00.000000 +00:00 | 5 |
| 20838 | PG0001 | 2017-08-26 12:15:00.000000 +00:00 | 6 |
| 20837 | PG0001 | 2017-09-02 12:15:00.000000 +00:00 | 7 |
| 20836 | PG0001 | 2017-09-09 12:15:00.000000 +00:00 | 8 |
| 32037 | PG0002 | 2017-07-16 07:10:00.000000 +00:00 | 1 |
| 32035 | PG0002 | 2017-07-23 07:10:00.000000 +00:00 | 2 |

The flights are returned for each `flight_no` partition with the expected `row_number`. Window functions can not be used in the `WHERE` clause so we have a to use a subquery to select the first row.

```sql
SELECT
  flight_id,
  flight_no,
  scheduled_departure
FROM (
  SELECT
    flight_id,
    flight_no,
    scheduled_departure,
    row_number() OVER (PARTITION BY flight_no ORDER BY scheduled_departure) AS row_number
  FROM
    flights
  ) AS fl
WHERE
  row_number = 1
```

returning the result we were looking for:

| flight\_id | flight\_no | scheduled\_departure |
| :--- | :--- | :--- |
| 20835 | PG0001 | 2017-07-22 12:15:00.000000 +00:00 |
| 32037 | PG0002 | 2017-07-16 07:10:00.000000 +00:00 |
| 29889 | PG0003 | 2017-07-18 06:50:00.000000 +00:00 |
| 30967 | PG0004 | 2017-07-16 09:45:00.000000 +00:00 |
| 1222 | PG0005 | 2017-07-16 12:40:00.000000 +00:00 |
| 17889 | PG0006 | 2017-07-17 14:20:00.000000 +00:00 |
| 3706 | PG0007 | 2017-07-16 09:40:00.000000 +00:00 |
| 3727 | PG0008 | 2017-07-16 08:45:00.000000 +00:00 |
| 16809 | PG0009 | 2017-07-16 09:10:00.000000 +00:00 |
| 16921 | PG0010 | 2017-07-16 09:25:00.000000 +00:00 |

This technique can be used to select any subset of rows within a partition, such as the first 5 rows (`row_number BETWEEN 1 AND 5`), 2nd row, or last row.

## Ranks

`row_number` returns the returned position of the row within the partition and does not take account of rows with the same sort position. `rank` and `dense_rank` give rows with the same sort position the same rank as demonstrated with this query;

```sql
SELECT
    flight_id,
    aircraft_code,
    flight_no,
    row_number() OVER code_by_no AS row_number,
    rank() OVER code_by_no AS rank,
    dense_rank() OVER code_by_no AS dense_rank
FROM
    flights
WINDOW
    code_by_no AS (PARTITION BY aircraft_code ORDER BY flight_no)
```

(see the previous article for a description of the `WINDOW` clause)

Which returns (some rows skipped)


| flight\_id | aircraft\_code | flight\_no | row\_number | rank | dense\_rank |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4413 | 319 | PG0064 | 1 | 1 | 1 |
| 4412 | 319 | PG0064 | 2 | 1 | 1 |
|  ... |
| 4405 | 319 | PG0064 | 26 | 1 | 1 |
| 29436 | 319 | PG0065 | 27 | 27 | 2 |
| 29440 | 319 | PG0065 | 28 | 27 | 2 |
| ... |
| 29432 | 319 | PG0065 | 52 | 27 | 2 |
| 21846 | 319 | PG0087 | 53 | 53 | 3 |
| 21845 | 319 | PG0087 | 54 | 53 | 3 |
| ... |
| 19944 | 319 | PG0710 | 1239 | 1231 | 46 |
| 9306 | 321 | PG0198 | 1 | 1 | 1 |

Rows with the same sort order are referred to as peers.

`rank()` assigns peer rows the same rank and skips ranks so that rows in the next peer group have a rank representing the overall position within the partition. 

This can be seen where the 26 rows in the first peer group (`flight_no` PG0064) have `rank` 1. Rows in the next peer group (`flight_no` PG0065) have `rank` 27.

`dense_rank()` does not skip ranks, resulting in the `dense_rank` being assigned to rows being consecutive. So the second peer group (`flight_no` PG0065) have a `dense_rank` of 2, and the third peer group has a `dense_rank` of 3.
const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: "eu-west-1",
});

exports.handler = async (event) => {
  let connectionData;
  const { storeId, conversationId } = JSON.parse(event.body);

  try {
    const params = {
      FilterExpression:
        "conversationId = :conversationId AND storeId = :storeId",
      ExpressionAttributeValues: {
        ":storeId": storeId,
        ":conversationId": conversationId,
      },
      ExpressionAttributeNames: {
        "#d": "date",
        "#f": "format",
      },
      ProjectionExpression:
        "conversationId,storeId,#d,#f,message,audioFile,authorId,productId",
      TableName: "yownit_chat",
    };
    connectionData = await ddb.scan(params).promise();
  } catch (e) {
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(connectionData),
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};
